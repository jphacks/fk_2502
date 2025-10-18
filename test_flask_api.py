import requests
import json

# Flask API configuration
FLASK_API_URL = "http://192.168.0.22:6000/process"
FILE_PATH = "./2.jpeg"

def send_prescription_image(api_url, file_path):
    try:
        # For testing, we'll use a sample Firebase Storage URL
        # In real app, this would be the actual Firebase Storage URL
        test_image_url = "https://firebasestorage.googleapis.com/v0/b/pillpal-11778.appspot.com/o/pills%2Ftest%2F123.jpg"
        
        data = {
            'image_url': test_image_url,
            'user_id': 'test_user_123',
            'timestamp': 1234567890
        }

        print(f"Sending Firebase Storage URL to {api_url}...")
        print(f"Image URL: {test_image_url}")

        response = requests.post(api_url, json=data)

        if response.status_code == 200:
            print("\n✅ Success! Server responded with:")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"\n❌ Error: Server responded with status code {response.status_code}")
            print("Response text:", response.text)

    except requests.exceptions.RequestException as e:
        print(f"\n❌ An error occurred while trying to connect to the server: {e}")

if __name__ == "__main__":
    send_prescription_image(FLASK_API_URL, FILE_PATH)
