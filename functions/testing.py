import os
import json
import google.generativeai as genai
from dotenv import load_dotenv
import easyocr
import firebase_admin
from firebase_admin import credentials,firestore

cred = credentials.Certificate("/Users/niwatorimostiqo/Desktop/Coding/PillPal/functions/firebase_key.json")
firebase_admin.initialize_app(cred)
db = firestore.client()



load_dotenv()

def gemini(prescript:str):

    prompt = f"""
    The user will send text read from a prescription.
    Read the information and return a JSON object and nothing else in the following format:
    {{
        "name": "name of the medicine",
        "times_per_day": "how many times to take the medicine per day as an integer",
        "information_of_medicine": "any other information such as dosage, e.g., '1 tablet', '500mg'"
    }}

    User query is:
    {prescript}
    """
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    generation_config = {
    "response_mime_type": "application/json",
    }

    model = genai.GenerativeModel(
        "gemini-2.5-flash",
        generation_config=generation_config,
    )

    response = model.generate_content(prompt)

    try:
        output_data = json.loads(response.text)
        print("Successfully parsed JSON output:")
        print(output_data)

        # You can now easily work with the structured data
        print(f"Name: {output_data['name']}")
        print(f"times_daily: {output_data['times_per_day']}")
        print(f"Information: {output_data['information_of_medicine']}")
        doc_ref = db.collection('prescriptions').add(output_data)
        print(f"Data successfully saved to Firestore with document ID: {doc_ref[1].id}")

    except json.JSONDecodeError:
        print("Error: Could not decode the JSON response.")
        print(f"Raw response: {response.text}")

def ocr()-> list[str]:
    reader = easyocr.Reader(['en']) 
    results = reader.readtext('/Users/niwatorimostiqo/Desktop/Coding/PillPal/functions/image-english.jpeg')
    final=[]
    for (bbox, text, prob) in results:
        print(f'Text: "{text}", Probability: {prob:.4f}')
        final.append(text)
    content= "\n".join(final)
    return content

content=str(ocr())
gemini(content)

