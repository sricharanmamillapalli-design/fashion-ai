from flask import Flask, render_template, request, jsonify
import numpy as np
import os
from datetime import datetime
from dotenv import load_dotenv
import cv2
from groq import Groq
from PIL import Image
import io
import tensorflow as tf

# Load environment variables
load_dotenv()
GROQ_API_KEY = os.getenv('PI_KEY')

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads/'

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Model variables
model = None
MODEL_ERROR = None
MODEL_PATH = None
CLASS_NAMES = ['Light', 'Medium', 'Dark']

print("DETECTION - LOADING MODEL")
print("\n" + "="*70)
print(" SKIN TONE DETECTION SYSTEM")
print("="*70)

try:
    print("✓ TensorFlow imported")
except Exception as e:
    MODEL_ERROR = f"Import failed: {e}"
    print(f"X {MODEL_ERROR}")

if MODEL_ERROR is None:
    current_dir = os.getcwd()
    print(f"✓ Directory: {current_dir}")
    try:
        h5_files = [f for f in os.listdir(current_dir) if f.endswith('.h5')]
        if h5_files:
            MODEL_PATH = os.path.join(current_dir, h5_files[0])
            print(f"✓ Found: {h5_files[0]}")
            model = tf.keras.models.load_model(MODEL_PATH, compile=False)
            model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
            print(f"✓ Loaded! Input: {model.input_shape}, Output: {model.output_shape}")
        else:
            MODEL_ERROR = "No .h5 file found"
            print(f"X {MODEL_ERROR}")
    except Exception as e:
        MODEL_ERROR = str(e)
        print(f"X {MODEL_ERROR}")

def prepare_image(image_file):
    if model is None:
        return None
    try:
        img = Image.open(image_file)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        input_shape = model.input_shape
        if len(input_shape) == 2:
            img = img.resize((64, 64))
            img_array = np.array(img, dtype='float32') / 255.0
            img_gray = np.mean(img_array, axis=2)
            expected_size = input_shape[1]
            img_flat = img_gray.flatten()
            if len(img_flat) < expected_size:
                img_flat = np.pad(img_flat, (0, expected_size - len(img_flat)))
            img_flat = img_flat[:expected_size]
            return np.expand_dims(img_flat, axis=0)
        else:
            img_size = (input_shape[1], input_shape[2])
            img = img.resize(img_size)
            img_array = np.array(img, dtype='float32') / 255.0
            return np.expand_dims(img_array, axis=0)
    except Exception as e:
        print(f"Image error: {e}")
        return None

# Initialize Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

def detect_skin_tone(image_path):
    """Detect skin tone category using the model"""
    prepared = prepare_image(image_path)
    if prepared is None:
        return None
    prediction = model.predict(prepared)
    predicted_class = np.argmax(prediction, axis=1)[0]
    return CLASS_NAMES[predicted_class]

def get_styling_recommendations(skin_tone_category):
    """Get AI-powered styling recommendations based on skin tone category"""
    try:
        prompt = f"""
        Based on a {skin_tone_category} skin tone, provide personalized fashion and makeup styling recommendations.
        Consider this skin tone for clothing colors that complement it, makeup suggestions, and overall style advice.
        Keep the response concise but helpful, around 200-300 words.
        """
        
        response = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="mixtral-8x7b-32768",
            max_tokens=500
        )
        
        return response.choices[0].message.content
    except Exception as e:
        return f"Error getting recommendations: {str(e)}"

@app.route('/')
def home():
    if os.path.exists('templates/index.html'):
        return render_template('index.html')
    else:
        return f'''
        <html><head><title>StyleAI - Skin Tone Detection</title><style>
        *{{margin:0;padding:0;box-sizing:border-box}}
        body{{font-family:Arial; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);min-height:100vh;padding:20px}}
        .container{{max-width:900px;margin:0 auto;background:white;border-radius:20px;padding:40px;box-shadow:0 20px 60px rgba(0,0,0,0.1)}}
        h1{{color:#333;margin-bottom:30px; text-align:center}}
        .status{{padding:25px;border-radius:12px;margin:25px 0;text-align:center}}
        .success{{background:#d4edda; color:#155724;border:2px solid #c3e6cb}}
        .error{{background:#f8d7da;color:#721c24;border:2px solid #f5c6cb}}
        .icon{{font-size:48px;margin-bottom:15px}}
        </style></head><body>
        <div class="container">
        <h1>StyleAI - Skin Tone Detection</h1>
        <div class="status {'success' if MODEL_ERROR is None else 'error'}">
        <div class="icon">{'✓' if MODEL_ERROR is None else '✗'}</div>
        <h2>Model: {'LOADED' if model else 'NOT LOADED'}</h2>
        <p>{'Ready for skin tone detection!' if MODEL_ERROR is None else MODEL_ERROR}</p>
        </div>
        </div></body></html>
        '''

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({'success': False, 'error': 'Model not loaded'}), 500
    
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'}), 400
    
    try:
        # Save temporary file
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp_' + file.filename)
        file.save(temp_path)
        
        # Prepare image
        prepared = prepare_image(temp_path)
        if prepared is None:
            return jsonify({'success': False, 'error': 'Image processing failed'}), 500
        
        # Make prediction
        prediction = model.predict(prepared)
        print(f"Prediction: {prediction}")
        print(f"Shape: {prediction.shape}")
        
        # Get predicted class
        pred_class = np.argmax(prediction[0])
        confidence = np.max(prediction[0]) * 100
        
        result = CLASS_NAMES[pred_class]
        
        # Get probabilities for all classes
        probabilities = {CLASS_NAMES[i]: round(float(prediction[0][i]) * 100, 2) for i in range(len(CLASS_NAMES))}
        
        print(f"Result: {result}, Confidence: {confidence:.2f}%")
        
        # Get AI recommendations
        recommendations = get_styling_recommendations(result)
        
        return jsonify({
            'success': True,
            'prediction': result,
            'confidence': round(confidence, 2),
            'probabilities': probabilities,
            'recommendations': recommendations,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.route('/health')
def health():
    return jsonify({'status': 'running', 'model_loaded': model is not None})

if __name__ == '__main__':
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    print("\n" + "="*70)
    print(f" {'✓' if model else 'X'} Model: {'LOADED' if model else 'NOT LOADED'}")
    if model:
        print(f" Input: {model.input_shape}, Output: {model.output_shape}")
    print(f" Server: http://127.0.0.1:5000")
    print("="*70 + "\n")
    app.run(debug=True, host='127.0.0.1', port=5000, use_reloader=False)