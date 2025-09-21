from flask import Flask, request, jsonify
from PIL import Image
import pytesseract
import pdfplumber
from pdf2image import convert_from_bytes
import json
import time
import asyncio
import aiohttp
from urllib.parse import quote
import nltk
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
from gtts import gTTS
import base64
from io import BytesIO
import os
from dotenv import load_dotenv


app = Flask(__name__)
load_dotenv()

# Initialize Phi-2 model for text rephrasing
try:
    print("[INFO] Loading Phi-2 model for text rephrasing...")
    
    # Load Phi-2 model and tokenizer
    model_name = "microsoft/phi-2"
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        model_name, 
        trust_remote_code=True,
        dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        # Removed device_map to avoid accelerate dependency
    )
    
    # Move model to GPU if available
    if torch.cuda.is_available():
        model = model.cuda()
    
    # Set padding token if not set
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    AI_AVAILABLE = True
    device_info = "GPU" if torch.cuda.is_available() else "CPU"
    print(f"[INFO] Phi-2 model loaded successfully on {device_info}")
except Exception as e:
    AI_AVAILABLE = False
    model = None
    tokenizer = None
    print(f"[WARN] Phi-2 model not available: {str(e)}. Rephrasing will be skipped.")

# ----------------- Load simplification dicts -----------------
with open("simplification.json", "r") as f:
    DICT_DATA = json.load(f)

SIMPLIFICATION_DICT = DICT_DATA.get("simplification_dict", {})
PHRASE_DICT = DICT_DATA.get("phrase_dict", {})
INDUSTRY_STANDARD_TERMS = set(term.lower() for term in DICT_DATA.get("industry_standard_terms", []))


# ----------------- Helpers -----------------
def count_syllables(word: str) -> int:
    """Estimate syllable count for filtering."""
    word = word.lower()
    count = 0
    vowels = "aeiouy"
    if word and word[0] in vowels:
        count += 1
    for index in range(1, len(word)):
        if word[index] in vowels and word[index - 1] not in vowels:
            count += 1
    if word.endswith("e"):
        count -= 1
    if count <= 0:
        count = 1
    return count

async def get_simple_synonym(word, cache):
    """Get synonym via dict first, then Datamuse fallback."""
    cleaned_word = word.lower().rstrip('.,;:"\'')
    suffix = word[len(cleaned_word):] if len(word) > len(cleaned_word) else ""
    
    print(f"[DEBUG] Processing word: '{word}' -> cleaned: '{cleaned_word}'")

    # 0. Check if it's an industry standard term - if so, don't simplify
    if cleaned_word in INDUSTRY_STANDARD_TERMS:
        print(f"[DEBUG] Industry standard term detected: '{cleaned_word}' - preserving original")
        return word

    # 1. Dictionary lookup
    if cleaned_word in SIMPLIFICATION_DICT:
        result = SIMPLIFICATION_DICT[cleaned_word] + suffix
        print(f"[DEBUG] Dict match: '{cleaned_word}' -> '{result}'")
        return result

    # 2. Cache lookup
    if cleaned_word in cache:
        result = cache[cleaned_word] + suffix
        print(f"[DEBUG] Cache match: '{cleaned_word}' -> '{result}'")
        return result

    # 3. Skip if already simple (but still check API for better alternatives)
    if count_syllables(cleaned_word) <= 2 and len(cleaned_word) <= 6:
        print(f"[DEBUG] Word '{cleaned_word}' is already simple")
        return word

    # 4. Datamuse API fallback
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"https://api.datamuse.com/words?rel_syn={quote(cleaned_word)}&md=f",
                timeout=3
            ) as response:
                synonyms = await response.json()
                print(f"[DEBUG] API returned {len(synonyms)} synonyms for '{cleaned_word}'")
                for syn in synonyms:
                    candidate = syn["word"].lower()
                    # Filter: short, common words only
                    if len(candidate) <= 7 and count_syllables(candidate) <= 2:
                        cache[cleaned_word] = candidate
                        result = candidate + suffix
                        print(f"[DEBUG] API match: '{cleaned_word}' -> '{result}'")
                        return result
    except Exception as e:
        print(f"[DEBUG] API error for {cleaned_word}: {e}")

    # 5. Fallback: return original
    print(f"[DEBUG] No simplification found for '{cleaned_word}', keeping original")
    return word

async def simplify_text_async(input_text):
    cache = {}
    try:
        with open("synonym_cache.json", "r") as f:
            cache = json.load(f)
    except FileNotFoundError:
        cache = {}

    # Apply phrase replacements first
    text = input_text.lower()
    for phrase, replacement in PHRASE_DICT.items():
        text = text.replace(phrase, replacement)
    sentences = nltk.sent_tokenize(text)

    simplified = []
    start_time = time.time()

    for sentence in sentences:
        words = nltk.word_tokenize(sentence)
        simplified_tokens = await asyncio.gather(
            *[get_simple_synonym(word, cache) for word in words]
        )
        simplified.append(" ".join(simplified_tokens))

    # Save cache
    with open("synonym_cache.json", "w") as f:
        json.dump(cache, f)

    latency = time.time() - start_time
    print(f"[INFO] Processing time: {latency:.2f} seconds")
    return " ".join(simplified)

def rephrase_text_ai(text: str) -> str:
    """Use Phi-2 model to rephrase simplified text for better coherence and flow."""
    print(f"[DEBUG] rephrase_text_ai called with AI_AVAILABLE={AI_AVAILABLE}")
    print(f"[DEBUG] Input text: '{text[:50]}...'")
    
    if not AI_AVAILABLE or model is None or tokenizer is None:
        print("[INFO] Phi-2 rephrasing not available, returning simplified text as-is")
        return text
    
    try:
        print("[DEBUG] Starting Phi-2 rephrasing...")
        # Split long text into sentences for better processing
        sentences = nltk.sent_tokenize(text)
        rephrased_sentences = []
        
        for i, sentence in enumerate(sentences):
            print(f"[DEBUG] Processing sentence {i+1}/{len(sentences)}: '{sentence[:30]}...'")
            
            if len(sentence.strip()) < 10:  # Skip very short sentences
                rephrased_sentences.append(sentence)
                continue
                
            # Create rephrasing prompt for Phi-2
            prompt = f"Rephrase this text to make it clearer and more coherent: \"{sentence.strip()}\"\nRephrased:"
            
            # Tokenize input
            inputs = tokenizer(prompt, return_tensors="pt", padding=True, truncation=True, max_length=512)
            
            # Move to same device as model
            if torch.cuda.is_available():
                inputs = {k: v.cuda() for k, v in inputs.items()}
            
            # Generate response
            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=len(sentence.split()) + 30,  # Allow some expansion
                    temperature=0.7,
                    do_sample=True,
                    pad_token_id=tokenizer.eos_token_id,
                    eos_token_id=tokenizer.eos_token_id
                )
            
            # Decode output
            generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Extract the rephrased part (after "Rephrased:")
            if "Rephrased:" in generated_text:
                rephrased_sentence = generated_text.split("Rephrased:")[-1].strip()
                # Remove any additional text after the sentence
                rephrased_sentence = rephrased_sentence.split('\n')[0].strip()
                if rephrased_sentence:
                    print(f"[DEBUG] Original: {sentence}")
                    print(f"[DEBUG] Rephrased: {rephrased_sentence}")
                    rephrased_sentences.append(rephrased_sentence)
                else:
                    rephrased_sentences.append(sentence)  # Fallback to original
            else:
                rephrased_sentences.append(sentence)  # Fallback to original
        
        final_result = " ".join(rephrased_sentences)
        print(f"[DEBUG] Phi-2 rephrasing completed: {len(text)} -> {len(final_result)} chars")
        return final_result
        
    except Exception as e:
        print(f"[ERROR] Phi-2 rephrasing failed: {str(e)}")
        return text  # Return original simplified text if Phi-2 fails

def _rephrase_chunk(text: str) -> str:
    """Legacy function - keeping for compatibility"""
    return rephrase_text_ai(text)

def full_simplification_with_stages(input_text: str) -> dict:
    """Return both vocabulary simplified and rephrased versions"""
    print(f"[DEBUG] Input text for simplification: '{input_text[:100]}...'")
    try:
        # Step 1: Vocabulary simplification
        vocab_simplified = asyncio.run(simplify_text_async(input_text)).strip()
        print(f"[DEBUG] Vocabulary simplification result: '{vocab_simplified[:100]}...'")
        
        # Step 2: AI rephrasing for better coherence
        final_rephrased = rephrase_text_ai(vocab_simplified)
        
        return {
            "vocabulary_simplified": vocab_simplified,
            "final_simplified": final_rephrased
        }
    except Exception as e:
        print(f"[ERROR] Simplification failed: {str(e)}")
        return {
            "vocabulary_simplified": input_text,
            "final_simplified": input_text
        }

def full_simplification(input_text: str) -> str:
    print(f"[DEBUG] Input text for simplification: '{input_text[:100]}...'")
    try:
        # Step 1: Vocabulary simplification
        simplified_result = asyncio.run(simplify_text_async(input_text)).strip()
        print(f"[DEBUG] Vocabulary simplification result: '{simplified_result[:100]}...'")
        
        # Step 2: AI rephrasing for better coherence
        final_result = rephrase_text_ai(simplified_result)
        print(f"[DEBUG] Final rephrased result: '{final_result[:100]}...'")
        
        return final_result
    except Exception as e:
        print(f"[ERROR] Simplification failed: {str(e)}")
        return input_text  # Return original text if simplification fails

# ----------------- Helper for TTS -----------------
def text_to_speech_base64(text: str, lang="en") -> dict:
    """Convert text to speech and return as base64 string with metadata."""
    try:
        tts = gTTS(text=text, lang=lang)
        fp = BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        audio_data = fp.read()
        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
        
        return {
            "audio_base64": audio_base64,
            "format": "mp3",
            "size_bytes": len(audio_data),
            "success": True
        }
    except Exception as e:
        print(f"[ERROR] TTS conversion failed: {str(e)}")
        return {
            "audio_base64": None,
            "format": None,
            "size_bytes": 0,
            "success": False,
            "error": str(e)
        }


# ----------------- Routes -----------------
@app.route("/simplify_text", methods=["POST"])
def simplify_text():
    data = request.get_json()
    text = data.get("text", "")
    if not text.strip():
        return jsonify({"error": "No text provided"}), 400

    simplified_text = full_simplification(text)
    audio_result = text_to_speech_base64(simplified_text)
    
    response = {
        "simplified_text": simplified_text,
        "audio": audio_result
    }
    
    return jsonify(response)

@app.route("/simplify_ocr", methods=["POST"])
def simplify_ocr():
    try:
        file = request.files.get("image")
        if not file:
            return jsonify({"error": "No image uploaded"}), 400

        img = Image.open(file.stream)        
        text = pytesseract.image_to_string(img)
        if not text.strip():
            return jsonify({"error": "No text found in image"}), 400

        results = full_simplification_with_stages(text)
        audio_result = text_to_speech_base64(results["final_simplified"])

        return jsonify({
            "original_text": text,
            "final_simplified": results["final_simplified"],
            "phi2_rephrasing": AI_AVAILABLE,
            "audio": audio_result
        })
    except Exception as e:
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500

@app.route("/simplify_pdf", methods=["POST"])
def simplify_pdf():
    file = request.files.get("pdf")
    if not file:
        return jsonify({"error": "No PDF uploaded"}), 400

    text_output = []
    try:
        with pdfplumber.open(file.stream) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_output.append(text)
    except Exception as e:
        print(f"[WARN] PDF parsing error: {e}")

    if not "".join(text_output).strip():
        try:
            file.stream.seek(0)
            images = convert_from_bytes(file.read())
            for img in images:
                text_output.append(pytesseract.image_to_string(img))
        except Exception as e:
            return jsonify({"error": f"PDF OCR failed: {str(e)}"}), 500

    extracted_text = "\n".join(text_output)
    if not extracted_text.strip():
        return jsonify({"error": "No text found in PDF"}), 400

    simplified_text = full_simplification(extracted_text)
    audio_result = text_to_speech_base64(simplified_text)

    return jsonify({
        "simplified_text": simplified_text,
        "audio": audio_result
    })
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(debug=True,port=port) 
 
