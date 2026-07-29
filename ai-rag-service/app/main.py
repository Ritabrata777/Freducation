import os
from typing import Literal

import httpx
from fastapi import FastAPI
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ToolId = Literal[
    "study-guide",
    "quiz",
    "flashcards",
    "learning-path",
    "concept-explainer",
    "request-match",
]

TOOL_LABELS: dict[str, str] = {
    "study-guide": "Study Guide",
    "quiz": "Quiz Generator",
    "flashcards": "Flashcards",
    "learning-path": "Learning Path",
    "concept-explainer": "Concept Explainer",
    "request-match": "Request Matcher",
}

TOOL_INSTRUCTIONS: dict[str, str] = {
    "study-guide": "Create revision notes with key concepts, definitions, examples, and next steps.",
    "quiz": "Create 5 MCQs with options, answer key, and short explanations.",
    "flashcards": "Create 8 active-recall flashcards as question-answer pairs.",
    "learning-path": "Create a step-by-step path with milestones, practice, and estimated effort.",
    "concept-explainer": "Explain clearly with intuition, examples, applications, and common mistakes.",
    "request-match": "Match learner needs to available materials, identify gaps, and suggest uploads.",
}

app = FastAPI(title="Freducation AI RAG Service", version="0.1.0")


class AiToolRequest(BaseModel):
    tool: ToolId
    prompt: str = Field(min_length=1)
    context: str = ""


class AiToolResponse(BaseModel):
    text: str
    source: Literal["python-rag-literouter", "python-rag-fallback"]
    retrieved_context: list[str]


def chunk_context(context: str) -> list[str]:
    chunks: list[str] = []
    for block in context.split("\n"):
        block = block.strip()
        if len(block) >= 20 and not block.endswith(":"):
            chunks.append(block)
    return chunks[:80]


def retrieve(prompt: str, context: str, limit: int = 6) -> list[str]:
    chunks = chunk_context(context)
    if not chunks:
        return []

    corpus = [prompt, *chunks]
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=3000)
    matrix = vectorizer.fit_transform(corpus)
    scores = cosine_similarity(matrix[0:1], matrix[1:]).flatten()
    ranked = sorted(zip(chunks, scores), key=lambda item: item[1], reverse=True)
    return [chunk for chunk, score in ranked[:limit] if score > 0]


def fallback_generate(tool: ToolId, prompt: str, retrieved: list[str]) -> str:
    label = TOOL_LABELS[tool]
    evidence = "\n".join(f"- {item}" for item in retrieved) or "- No matching library context found yet."

    if tool == "quiz":
        body = "\n".join(
            f"{i}. Question about {prompt}?\n   A. Option A\n   B. Option B\n   C. Option C\n   D. Option D\n   Answer: A — Review the matched material context."
            for i in range(1, 6)
        )
    elif tool == "flashcards":
        body = "\n".join(
            f"Q{i}: Key idea from {prompt}?\nA{i}: Use the retrieved context to revise this idea."
            for i in range(1, 9)
        )
    elif tool == "learning-path":
        body = "1. Learn fundamentals\n2. Review matched materials\n3. Practice questions\n4. Build or solve examples\n5. Revise weak areas"
    elif tool == "concept-explainer":
        body = f"Break {prompt} into definition, intuition, example, application, and common mistakes."
    elif tool == "request-match":
        body = "Matched resources and gaps are listed below. Contributors should upload focused notes, solved examples, or quizzes where matches are weak."
    else:
        body = "Overview\nKey concepts\nImportant definitions\nExamples\nRevision checklist\nNext steps"

    return f"{label}: {prompt}\n\n{body}\n\nRetrieved context:\n{evidence}"


async def literouter_generate(tool: ToolId, prompt: str, retrieved: list[str]) -> str | None:
    api_key = os.getenv("LITEROUTER_API_KEY") or os.getenv("LITE_ROUTER_API_KEY") or os.getenv("AI_API_KEY")
    if not api_key:
        return None

    model = os.getenv("AI_MODEL", "gpt-5-nano")
    base_url = os.getenv("LITEROUTER_BASE_URL", os.getenv("AI_GATEWAY_URL", "https://api.literouter.com/v1")).rstrip("/")
    context = "\n".join(f"- {item}" for item in retrieved)
    user_prompt = (
        f"Tool: {TOOL_LABELS[tool]}\n"
        f"Instruction: {TOOL_INSTRUCTIONS[tool]}\n"
        f"Learner prompt: {prompt}\n\n"
        f"Retrieved Freducation context:\n{context}\n\n"
        "Return concise, well-structured output."
    )

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{base_url}/chat/completions",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are Freducation AI Tools, a concise context-aware learning assistant.",
                    },
                    {"role": "user", "content": user_prompt},
                ],
            },
        )
    if response.status_code >= 400:
        return None
    data = response.json()
    text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return text.strip() or None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ai-tools/run", response_model=AiToolResponse)
async def run_ai_tool(payload: AiToolRequest) -> AiToolResponse:
    retrieved = retrieve(payload.prompt, payload.context)
    generated = await literouter_generate(payload.tool, payload.prompt, retrieved)
    if generated:
        return AiToolResponse(text=generated, source="python-rag-literouter", retrieved_context=retrieved)

    return AiToolResponse(
        text=fallback_generate(payload.tool, payload.prompt, retrieved),
        source="python-rag-fallback",
        retrieved_context=retrieved,
    )
