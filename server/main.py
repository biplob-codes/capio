from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
app=FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],   
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def home():
    return {"status":"Server is healthy!!!"}
if __name__=="__main__":
    import uvicorn
    uvicorn.run(app,host="127.0.0.1",port=3000)