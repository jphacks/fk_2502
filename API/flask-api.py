import os
import json
import asyncio
from dotenv import load_dotenv
import chromadb
from google import genai
from google.genai import types
from flask import Flask, request, jsonify
import requests
import smtplib
import ssl
from email.message import EmailMessage


load_dotenv()

CLIENT = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
app = Flask(__name__)

def photo():
    with open('./unnamed.png', 'rb') as f:
        image_bytes = f.read()

    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[
            types.Part.from_bytes(
                data=image_bytes,
                mime_type='image/jpeg',
            ),
            """
            The user will send text read from a prescription.
            Read the information and return a JSON object and nothing else in the following format:
            MAKE SURE ALL NUMBERS ARE IN ENGLISH SYSTEM FORMAT
            {{
                "name": "name of the medicine",
                "frequency_per_day": (integer),
                "dosage": (string),
                "duration_of_intake": (integer of days, else null),
                "extra_information": (any extra information, string)
            }}
            """
        ],
        config={
            "response_mime_type": "application/json",
        }
    )
    
    print(response.text)
    return response.text


async def get_med_details(med_name: str):
    print(f"--- Accessing Vector DB for: {med_name} ---")
    chroma_client = chromadb.PersistentClient(path="./medicines")
    collection = chroma_client.get_collection(name="meds")

    query_result = CLIENT.models.embed_content(
        model="models/text-embedding-004",
        contents=med_name,
    )

    query_embedding = query_result.embeddings[0].values
    results = collection.query(
        query_embeddings=[query_embedding], 
        n_results=3
    )
    
    retrieved_documents = results['documents'][0]
    context = "\n---\n".join(retrieved_documents)
    print(f"Found {len(retrieved_documents)} relevant document chunks.")

    prompt = f"""
        Based on the context provided, return a JSON object for the requested medicine. If the information is not in the context, return null for that field.
        
        Return in this exact format:
        {{
            "condition": "medical condition this treats",
            "instructions": "how to use the medicine",
            "sideEffects": ["list", "of", "side", "effects"]
        }}

        CONTEXT:
        {context}
        ---
        MEDICINE NAME: {med_name}
    """

    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config={
            "response_mime_type": "application/json",
        }
    )

    print("--- Final Generated Response ---")
    print(response.text)
    with open("response.txt", "a", encoding="utf-8") as f:
        f.write(response.text + "\n")

    return json.loads(response.text)


async def main(content):
    try:
        print("content is", content)
        medicine_name_to_search = content.get("name")
        print(f"Searching for medicine: {medicine_name_to_search}")

        if medicine_name_to_search:
            details = await get_med_details(medicine_name_to_search)
            return details
        else:
            print("Error: Could not find the 'name' key in the response from Gemini.")
            return None

    except json.JSONDecodeError:
        print("Error: Failed to parse the JSON response from Gemini.")
        print("Received:", content)
        return None
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return None


@app.route('/process', methods=['POST'])
def process():
    try:
        # Check if a file was sent in the request
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        
        # Check if a file was actually selected
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Read the file bytes
        image_bytes = file.read()
        
        # Process with Gemini to extract prescription info
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type='image/jpeg',
                ),
                """
                The user will send text read from a prescription.
                Read the information and return a JSON object and nothing else in the following format:
                MAKE SURE ALL NUMBERS ARE IN ENGLISH SYSTEM FORMAT
                {{
                    "name": "name of the medicine",
                    "frequency_per_day": (integer),
                    "dosage": (string describing the dosage),
                    "duration_of_intake": (integer of days, else null),
                    "extra_information": (any extra information, string)
                }}
                """
            ],
            config={
                "response_mime_type": "application/json",
            }
        )
        
        # Parse the initial prescription data
        content = json.loads(response.text)
        print("Initial prescription data:", content)
        
        # Build the final response object
        final = {
            "pillName": content.get("name", "Unknown Medicine"),
            "dosageInfo": content.get("extra_information", ""),
            "dosage": int(content.get("frequency_per_day", 1)),
            "duration": int(content.get("duration_of_intake", 7)) if content.get("duration_of_intake") else 7,
        }
        
        # Get additional medicine details from vector DB
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        print("Getting additional medicine details from vector DB...")
        response_final = loop.run_until_complete(main(content))
        loop.close()
        
        if response_final:
            # ✅ FIX: response_final is now already a dict (parsed in get_med_details)
            final["condition"] = response_final.get("condition", "")
            final["instructions"] = response_final.get("instructions", "")
            final["sideEffects"] = response_final.get("sideEffects", [])
            
            print("Final response:", final)
            return jsonify({"response": final}), 200
        else:
            # Return basic info even if vector DB lookup fails
            final["condition"] = ""
            final["instructions"] = ""
            final["sideEffects"] = []
            print("Vector DB lookup failed, returning basic info")
            return jsonify({"response": final}), 200
        
    except Exception as e:
        print(f"Error in /process endpoint: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/notify', methods= ["POST"])
def notification():
    topic = 'PillPal' 
    message = 'お薬を飲んでください! 💊'
    title = 'Pill Pal - リマインダー'

    requests.post(
        f"https://ntfy.sh/{topic}",
        data=message.encode('utf-8'), 
        headers={
            "Title": title.encode('utf-8'), 
            "Priority": "high", 
            "Tags": "alarm_clock" 
        }
    )
    return jsonify({"status":"sent"}), 200


@app.route('/email', methods=['POST'])
def send_notification():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400
    try:
        SENDER_EMAIL = data.get("sender_email")
        SENDER_PASSWORD = data.get("sender_password")
        RECIPIENT_EMAIL = data.get("recipient_email")
        title = data.get('title', 'PillPal Alert') 
        message = data.get('message', 'This is an automated alert from PillPal.') 


        if not all([SENDER_EMAIL, SENDER_PASSWORD, RECIPIENT_EMAIL]):
            return jsonify({"error": "Missing sender_email, sender_password, or recipient_email in JSON payload"}), 400

        print(f"Sending email to: {RECIPIENT_EMAIL}")
        msg = EmailMessage()
        msg['Subject'] = title
        msg['From'] = SENDER_EMAIL
        msg['To'] = RECIPIENT_EMAIL
        msg.set_content(f"{message}\n\n(This is an automated alert from PillPal.)")

        context = ssl.create_default_context()

        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
            print("Email sent successfully!")

    except Exception as e:
        print(f"Error sending email: {e}")
        return jsonify({"error": f"Failed to send email: {e}"}), 500

    return jsonify({"status": "success", "message": "Email sent successfully"}), 200



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=6000, debug=True)
