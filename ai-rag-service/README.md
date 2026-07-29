# Freducation AI RAG Service

Python RAG/ML microservice for the dashboard AI Tools section. It follows the same product direction as LearnHouse-style context-aware AI tutoring, quiz generation, flashcards, and learning paths, implemented specifically for Freducation.

## Tools

- Study guides
- Quiz generation
- Flashcards
- Learning paths
- Concept explanations
- Request matching

## Run locally

```bash
cd ai-rag-service
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

This service is optional. Freducation AI Tools work directly with LiteRouter from the main app.

Use this service only if you want the Python RAG/ML retrieval layer:

```env
AI_RAG_SERVICE_URL=http://localhost:8000
LITEROUTER_API_KEY=your_literouter_key
AI_MODEL=gpt-5-nano
LITEROUTER_BASE_URL=https://api.literouter.com/v1
```

## Docker

```bash
docker compose -f docker-compose.ai.yml up --build
```
