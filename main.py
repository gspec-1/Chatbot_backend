# Explicitly disable LangSmith to prevent 403 errors
import os
os.environ["LANGCHAIN_TRACING_V2"] = "false"
os.environ["LANGCHAIN_API_KEY"] = ""

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from typing import Dict, Any, Optional
import uuid
import time
from datetime import datetime

from models import ChatRequest, ChatResponse, ChatMessage
from rag_system import rag_system
from n8n_integration import n8n_integration
from simple_knowledge_base import simple_knowledge_base as knowledge_base
from scheduling_system import consultation_scheduler
from consultation_logger import consultation_logger
from config import Config

# Initialize FastAPI app
app = FastAPI(
    title="Agentic AI Chatbot API",
    description="A RAG-based chatbot for agentic AI services company",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session storage (use Redis or database in production)
sessions: Dict[str, Dict[str, Any]] = {}

def get_session(session_id: str) -> Dict[str, Any]:
    """Get or create a session"""
    if session_id not in sessions:
        sessions[session_id] = {
            "id": session_id,
            "created_at": datetime.now(),
            "messages": [],
            "context": {}
        }
    return sessions[session_id]

@app.get("/")
async def root():
    """Root endpoint with basic information"""
    return {
        "message": "Agentic AI Chatbot API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "chat": "/chat",
            "health": "/health",
            "docs": "/docs"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "rag_system": "operational",
            "knowledge_base": "operational",
            "n8n_integration": "enabled" if Config.N8N_WEBHOOK_URL else "disabled (using local processing)"
        }
    }

@app.post("/chat", response_model=ChatResponse)
async def chat(chat_request: ChatRequest):
    """
    Main chat endpoint that processes user messages and returns AI responses
    """
    try:
        # Generate session ID if not provided
        session_id = chat_request.session_id or str(uuid.uuid4())
        
        # Get or create session
        session = get_session(session_id)
        
        # Add user message to session
        user_message = ChatMessage(
            role="user",
            content=chat_request.message,
            timestamp=datetime.now()
        )
        session["messages"].append(user_message.dict())
        
        # Process with RAG system
        rag_response = rag_system.chat(
            query=chat_request.message,
            session_id=session_id,
            user_context=chat_request.context or session.get("context", {})
        )
        
        # Send to n8n workflow for data structuring (optional component)
        n8n_result = n8n_integration.send_to_n8n_workflow(chat_request, rag_response)
        
        # Process structured data from n8n if available
        if n8n_result:
            structured_data = n8n_integration.process_structured_data(n8n_result)
            # Update session context with structured data
            session["context"].update(structured_data)
        
        # Add assistant message to session
        assistant_message = ChatMessage(
            role="assistant",
            content=rag_response.response,
            timestamp=datetime.now()
        )
        session["messages"].append(assistant_message.dict())
        
        # Update session
        sessions[session_id] = session
        
        return rag_response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing chat request: {str(e)}")

@app.get("/sessions/{session_id}")
async def get_session_history(session_id: str):
    """Get chat history for a specific session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    
    # Get conversation summary from RAG system
    conversation_summary = rag_system.get_conversation_summary(session_id)
    
    return {
        "session_id": session_id,
        "created_at": session["created_at"],
        "message_count": len(session["messages"]),
        "messages": session["messages"],
        "context": session["context"],
        "conversation_summary": conversation_summary
    }

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a chat session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Clear conversation memory
    rag_system.clear_conversation_memory(session_id)
    
    del sessions[session_id]
    return {"message": "Session deleted successfully"}

@app.get("/sessions")
async def list_sessions():
    """List all active sessions"""
    return {
        "sessions": [
            {
                "session_id": session_id,
                "created_at": session["created_at"],
                "message_count": len(session["messages"])
            }
            for session_id, session in sessions.items()
        ]
    }

@app.post("/knowledge-base/add-text")
async def add_text_to_knowledge_base(texts: list[str], metadata: Optional[list[dict]] = None):
    """Add text documents to the knowledge base"""
    try:
        knowledge_base.add_documents_from_text(texts, metadata)
        return {"message": f"Added {len(texts)} documents to knowledge base"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding documents: {str(e)}")

@app.post("/knowledge-base/upload-pdf")
async def upload_pdf_to_knowledge_base(file: UploadFile = File(...)):
    """Upload and process a PDF file to add to the knowledge base"""
    try:
        # Check if file is PDF
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Create uploads directory if it doesn't exist
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save uploaded file
        file_path = os.path.join(upload_dir, file.filename)
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Add to knowledge base
        knowledge_base.add_documents_from_file(file_path)
        
        return {
            "message": f"Successfully uploaded and processed {file.filename}",
            "filename": file.filename,
            "file_path": file_path
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

@app.get("/knowledge-base/search")
async def search_knowledge_base(query: str, k: int = 5):
    """Search the knowledge base"""
    try:
        results = knowledge_base.search(query, k=k)
        return {
            "query": query,
            "results": results,
            "count": len(results)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching knowledge base: {str(e)}")

@app.get("/knowledge-base/status")
async def get_knowledge_base_status():
    """Get knowledge base status and statistics"""
    try:
        status = knowledge_base.get_knowledge_base_status()
        return {
            "status": "success",
            "knowledge_base": status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting knowledge base status: {str(e)}")

@app.post("/knowledge-base/initialize")
async def initialize_knowledge_base():
    """Initialize the knowledge base with default agentic AI content"""
    try:
        knowledge_base.initialize_with_agentic_ai_content()
        return {"message": "Knowledge base initialized with agentic AI content"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error initializing knowledge base: {str(e)}")

@app.get("/n8n/status")
async def get_n8n_status():
    """Get N8N integration status"""
    return {
        "configured": bool(Config.N8N_WEBHOOK_URL),
        "webhook_url": Config.N8N_WEBHOOK_URL,
        "api_key_configured": bool(Config.N8N_API_KEY),
        "fallback_mode": "local_data_processing" if not Config.N8N_WEBHOOK_URL else "n8n_workflow"
    }

@app.get("/analytics/processing-stats")
async def get_processing_statistics():
    """Get processing statistics from local data processor"""
    try:
        from data_processor import local_data_processor
        stats = local_data_processor.get_processing_statistics()
        return {
            "status": "success",
            "statistics": stats,
            "processing_method": "local_data_processing"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "processing_method": "local_data_processing"
        }

@app.get("/memory/sessions")
async def get_all_memory_sessions():
    """Get all active conversation memory sessions"""
    try:
        sessions = rag_system.get_all_sessions()
        return {
            "active_sessions": sessions,
            "total_sessions": len(sessions)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting memory sessions: {str(e)}")

@app.get("/memory/sessions/{session_id}")
async def get_conversation_memory(session_id: str):
    """Get conversation memory for a specific session"""
    try:
        summary = rag_system.get_conversation_summary(session_id)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting conversation memory: {str(e)}")

@app.delete("/memory/sessions/{session_id}")
async def clear_conversation_memory(session_id: str):
    """Clear conversation memory for a specific session"""
    try:
        success = rag_system.clear_conversation_memory(session_id)
        if success:
            return {"message": f"Conversation memory cleared for session {session_id}"}
        else:
            raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing conversation memory: {str(e)}")

# Serve static files (for the web interface)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/chat-interface", response_class=HTMLResponse)
async def chat_interface():
    """Serve the chat interface"""
    try:
        with open("static/chat.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(
            content="<h1>Chat interface not found</h1><p>Please ensure static/chat.html exists</p>",
            status_code=404
        )

@app.get("/pdf-upload", response_class=HTMLResponse)
async def pdf_upload_interface():
    """Serve the PDF upload interface"""
    try:
        with open("static/pdf_upload.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(
            content="<h1>PDF upload interface not found</h1><p>Please ensure static/pdf_upload.html exists</p>",
            status_code=404
        )

@app.get("/schedule-consultation", response_class=HTMLResponse)
async def consultation_scheduler_interface():
    """Serve the consultation scheduler interface"""
    try:
        with open("static/consultation_scheduler.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(
            content="<h1>Consultation scheduler not found</h1><p>Please ensure static/consultation_scheduler.html exists</p>",
            status_code=404
        )

@app.get("/admin-dashboard", response_class=HTMLResponse)
async def admin_dashboard_interface():
    """Serve the admin dashboard interface"""
    try:
        with open("static/admin_dashboard.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(
            content="<h1>Admin dashboard not found</h1><p>Please ensure static/admin_dashboard.html exists</p>",
            status_code=404
        )

# Consultation Scheduling Endpoints
@app.get("/consultation/available-slots")
async def get_available_consultation_slots():
    """Get available consultation time slots"""
    try:
        slots = consultation_scheduler.get_available_slots()
        return {
            "status": "success",
            "available_slots": slots
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting available slots: {str(e)}")

@app.post("/consultation/schedule")
async def schedule_consultation(
    request: Request,
    name: str = "",
    email: str = "",
    phone: str = "",
    company: str = "",
    preferred_date: str = "",
    preferred_time: str = "",
    message: str = ""
):
    """Schedule a new consultation"""
    try:
        # Attempt to parse JSON body (for programmatic scheduling)
        try:
            body = await request.json()
            if isinstance(body, dict):
                name = body.get("name", name)
                email = body.get("email", email)
                phone = body.get("phone", phone)
                company = body.get("company", company)
                preferred_date = body.get("preferred_date", preferred_date)
                preferred_time = body.get("preferred_time", preferred_time)
                message = body.get("message", message)
        except Exception:
            # If no JSON body, continue with query/form params
            pass

        # Get client information for logging
        ip_address = request.client.host if request else ""
        user_agent = request.headers.get("user-agent", "") if request else ""
        
        result = consultation_scheduler.schedule_consultation(
            name=name,
            email=email,
            phone=phone,
            company=company,
            preferred_date=preferred_date,
            preferred_time=preferred_time,
            message=message,
            ip_address=ip_address,
            user_agent=user_agent
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scheduling consultation: {str(e)}")

@app.get("/consultation/available-slots")
async def get_available_consultation_slots():
    """Get available consultation time slots"""
    try:
        slots = consultation_scheduler.get_available_slots()
        return {
            "status": "success",
            "available_slots": slots
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting available slots: {str(e)}")

@app.get("/consultation/status/{consultation_id}")
async def get_consultation_status(consultation_id: str):
    """Get status of a consultation request"""
    try:
        result = consultation_scheduler.get_consultation_status(consultation_id)
        if result["found"]:
            return result
        else:
            raise HTTPException(status_code=404, detail="Consultation request not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting consultation status: {str(e)}")

@app.get("/consultation/all")
async def get_all_consultations():
    """Get all consultation requests (admin endpoint)"""
    try:
        requests = consultation_scheduler.get_all_requests()
        return {
            "status": "success",
            "total_requests": len(requests),
            "requests": requests
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting consultations: {str(e)}")

@app.put("/consultation/update-status/{consultation_id}")
async def update_consultation_status(consultation_id: str, status: str):
    """Update consultation status (admin endpoint)"""
    try:
        result = consultation_scheduler.update_consultation_status(consultation_id, status)
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=404, detail="Consultation request not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating consultation status: {str(e)}")

@app.delete("/consultation/delete/{consultation_id}")
async def delete_consultation(consultation_id: str):
    """Delete a consultation request (admin endpoint)"""
    try:
        result = consultation_scheduler.delete_consultation(consultation_id)
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=404, detail="Consultation request not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting consultation: {str(e)}")

# Admin Logging and Team Management Endpoints
@app.get("/admin/logs/recent")
async def get_recent_consultation_logs(hours: int = 24):
    """Get recent consultation logs (admin endpoint)"""
    try:
        logs = consultation_logger.get_recent_logs(hours=hours)
        return {
            "status": "success",
            "total_logs": len(logs),
            "logs": logs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting recent logs: {str(e)}")

@app.get("/admin/logs/status/{status}")
async def get_logs_by_status(status: str):
    """Get logs by status (admin endpoint)"""
    try:
        logs = consultation_logger.get_logs_by_status(status)
        return {
            "status": "success",
            "total_logs": len(logs),
            "logs": logs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting logs by status: {str(e)}")

@app.get("/admin/logs/date-range")
async def get_logs_by_date_range(start_date: str, end_date: str):
    """Get logs by date range (admin endpoint)"""
    try:
        logs = consultation_logger.get_logs_by_date_range(start_date, end_date)
        return {
            "status": "success",
            "total_logs": len(logs),
            "logs": logs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting logs by date range: {str(e)}")

@app.get("/admin/stats")
async def get_consultation_stats():
    """Get consultation statistics (admin endpoint)"""
    try:
        stats = consultation_logger.get_consultation_stats()
        return {
            "status": "success",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting stats: {str(e)}")

@app.get("/admin/team")
async def get_team_members():
    """Get all team members (admin endpoint)"""
    try:
        team_members = consultation_logger.get_team_members()
        return {
            "status": "success",
            "total_members": len(team_members),
            "team_members": team_members
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting team members: {str(e)}")

@app.post("/admin/team/add")
async def add_team_member(name: str, email: str, role: str, phone: str = ""):
    """Add a new team member (admin endpoint)"""
    try:
        result = consultation_logger.add_team_member(name, email, role, phone)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding team member: {str(e)}")

@app.delete("/admin/team/remove/{email}")
async def remove_team_member(email: str):
    """Remove a team member (admin endpoint)"""
    try:
        result = consultation_logger.remove_team_member(email)
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=404, detail="Team member not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing team member: {str(e)}")

@app.post("/admin/clear-all-logs")
async def clear_all_consultation_logs():
    """Clear all consultation logs (admin endpoint)"""
    try:
        result = consultation_logger.clear_all_logs()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing logs: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=Config.HOST,
        port=Config.PORT,
        reload=True
    )
