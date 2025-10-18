# API Key Fix for Railway Deployment

## Problem
The chatbot was experiencing HTTP 500 errors when making requests to OpenAI API due to an "Illegal header value" error. The issue was caused by a newline character (`\n`) at the end of the OpenAI API key in the environment variable.

## Root Cause
When environment variables are set in Railway (or other deployment platforms), they often include trailing newlines or whitespace characters. The error occurred because:

1. The API key was loaded directly from environment variables without stripping whitespace
2. The newline character was being included in the HTTP Authorization header
3. This caused the HTTP client to reject the request with "Illegal header value"

## Solution
Updated the configuration handling to properly strip whitespace and newlines from environment variables:

### Changes Made

1. **config.py** - Updated API key loading:
   ```python
   # Before
   OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
   
   # After
   OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
   ```

2. **Added validation** to ensure API key format is correct:
   ```python
   # Validate API key format
   if not OPENAI_API_KEY:
       raise ValueError("OPENAI_API_KEY environment variable is required")
   if not OPENAI_API_KEY.startswith("sk-"):
       raise ValueError("OPENAI_API_KEY must start with 'sk-'")
   ```

3. **Updated other environment variables** to strip whitespace:
   ```python
   N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "").strip() or None
   N8N_API_KEY = os.getenv("N8N_API_KEY", "").strip() or None
   ```

4. **Added validation** in RAG system and knowledge base initialization to catch API key issues early.

## Files Modified
- `config.py` - Main configuration file
- `rag_system.py` - Added API key validation
- `knowledge_base.py` - Added API key validation
- `test_api_key.py` - Test script to verify API key loading

## Testing
Run the test script to verify API key loading:
```bash
cd Chatbot/Chatbot
python test_api_key.py
```

## Deployment
1. Commit the changes to your repository
2. Push to trigger Railway deployment
3. The deployment should now work without the HTTP 500 errors

## Verification
After deployment, test the chat endpoint:
```bash
curl -X POST https://your-railway-app.up.railway.app/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'
```

The chatbot should now respond successfully without the "Illegal header value" error.
