from langchain_chroma import Chroma
from langchain_community.embeddings.sentence_transformer import SentenceTransformerEmbeddings
from langchain.prompts import PromptTemplate
from langchain_openai import OpenAI  # Updated import
import os

CHROMA_PATH = "chroma_db"
open_ai_api_key = "your_openai_api_key"
PROMPT_TEMPLATE = """Answer the question based only on the following context:

{context}

---

Answer the question based on the above context: {question}"""

def query_chroma_db(query):
    print(f"Querying Chroma DB with query: '{query}'")
    embedding_function = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
    db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embedding_function)

    # Check if the database has documents.
    print("Checking database documents...")
    docs = db.get()
    print(f"Documents in the database: {docs}")
    if not docs or not docs.get("documents"):
        print("The database is empty or no documents found.")
        return

    # Search the DB.
    print("Searching the database...")
    results = db.similarity_search(query, k=3)
    print(f"Search results: {results}")
    if not results:
        print("Unable to find matching results.")
        return

    context_text = "\n\n---\n\n".join([doc.page_content for doc in results])
    print(f"Context text: {context_text}")

    # Create the prompt and get the model's response
    prompt_template = PromptTemplate.from_template(PROMPT_TEMPLATE)
    prompt = prompt_template.format(context=context_text, question=query)
    print(f"Prompt: {prompt}")

    model = OpenAI(api_key=open_ai_api_key)
    response_text = model.invoke(prompt)
    print(f"Response text: {response_text}")

    sources = list({doc.metadata.get("source", None) for doc in results})
    formatted_response = f"Response: {response_text}\nSources: {sources}"
    print(formatted_response)

if __name__ == "__main__":
    query_text = input("Please enter your query: ")
    query_chroma_db(query_text)
