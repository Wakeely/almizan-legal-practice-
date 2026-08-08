# Al Mizan OCR Service

Simple Python service for extracting text from Arabic legal documents.

## What It Does

When you upload a PDF or image to Al Mizan, this service:
1. **Digital PDFs/DOCX**: Extracts text directly (fast, no OCR needed)
2. **Scanned documents/images**: Uses PaddleOCR-VL to read the text (best for Arabic)

## Deployment (Railway - Recommended)

Railway is the easiest way to deploy this service. It has a free tier.

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with your GitHub account

### Step 2: Deploy the Service
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Select your repository: `almizan-legal-practice-`
4. In the settings, set:
   - **Root Directory**: `ocr-service`
   - **Build Command**: (leave empty)
   - **Start Command**: `python app.py`
5. Click "Deploy"

### Step 3: Get the Service URL
1. After deployment, click on the service
2. Go to "Settings" → "Networking"
3. Click "Generate Domain"
4. Copy the URL (something like `https://your-service.up.railway.app`)

### Step 4: Add to Al Mizan
1. Go to your Vercel dashboard
2. Select your Al Mizan project
3. Go to "Settings" → "Environment Variables"
4. Add: `OCR_SERVICE_URL` = your Railway URL from Step 3
5. Redeploy your Vercel project

## Alternative: Render

If you prefer Render:
1. Go to https://render.com
2. Create a "New Web Service"
3. Connect your GitHub repo
4. Settings:
   - **Root Directory**: `ocr-service`
   - **Runtime**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python app.py`
5. Deploy and get the URL

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OCR_PORT` | No | 8080 | Port to run on |
| `API_KEY` | No | - | Optional API key for authentication |

## Memory Requirements

PaddleOCR-VL uses **2-4GB RAM**. Make sure your deployment machine has at least 4GB.

- Railway free tier: 512MB (not enough)
- Railway paid tier ($5/month): 8GB (works)
- Render free tier: 512MB (not enough)
- Render paid tier ($7/month): 2GB (may work with optimization)

## Testing

After deployment, test the health endpoint:
```
https://your-service.up.railway.app/health
```

Should return: `{"status":"ok","engine":"paddleocr-vl"}`
