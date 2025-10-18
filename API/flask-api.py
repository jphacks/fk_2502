import os
import json
import asyncio
from dotenv import load_dotenv
import chromadb
from google import genai
from google.genai import types
from flask import Flask, request, jsonify
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
            "dosage":
            "duration of intake": (integer of days, else null)
            "extra information": (any extra information, string)
        }}
        """
        ],
        config = {
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
        f.write(response.text)
    return response.text

async def main(content):
    try:
        print("content is",content)
        med_info = json.loads(content)
        medicine_name_to_search = med_info.get("name")
        print(medicine_name_to_search)


        if medicine_name_to_search:
            text = await get_med_details(medicine_name_to_search)
            return text
        else:
            print("Error: Could not find the 'name' key in the response from Gemini.")
            return None

    except json.JSONDecodeError:
        print("Error: Failed to parse the JSON response from Gemini.")
        print("Received: data")
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
        
        # Process with Gemini
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
                    "dosage":
                    "duration_of_intake": (integer of days, else null)
                    "extra_information": (any extra information, string)
                }}
                """
            ],
            config={
                "response_mime_type": "application/json",
            }
        )
        
        content = json.loads(response.text)  # old json
        print("old json")
        final={}
        final["pillName"]=content["name"]
        final["dosageInfo"]=content["extra_information"]
        final["dosage"]=int(content["frequency_per_day"])
        final["duration"]=int(content["duration_of_intake"])
        # Run the async main function
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        print("getting new info")
        response_final = loop.run_until_complete(main(content))
        loop.close()
        
        if response_final:
            final["condition"]=response_final["condition"]
            final["instructions"]=response_final["instructions"]
            final["sideEffects"]=response_final["sideEffects"]
            
            return jsonify({"response": final}), 200
        else:
            return jsonify({"error": "Failed to get medicine details"}), 500
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0",port="6000",debug=True)

"""
get_med_details stores in response.txt -> store to history instead, then embed history, or just throw entire history into the llm

history.json
"""