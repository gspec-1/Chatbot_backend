/**
 * Agentic AI Chatbot Widget
 * A lightweight JavaScript widget for embedding the chatbot into any website
 */

class AgenticAIChatbotWidget {
    constructor(options = {}) {
        this.options = {
            apiUrl: options.apiUrl || '/chat',
            position: options.position || 'bottom-right', // 'bottom-right', 'bottom-left', 'top-right', 'top-left'
            theme: options.theme || 'default', // 'default', 'dark', 'light'
            primaryColor: options.primaryColor || '#4f46e5',
            secondaryColor: options.secondaryColor || '#7c3aed',
            title: options.title || 'Aken from AkenoTech',
            subtitle: options.subtitle || 'Hi! I\'m Aken from AkenoTech. Let me know how I can help you transform your business with custom AI solutions today!',
            placeholder: options.placeholder || 'How can AkenoTech\'s AI solutions help my business?',
            ...options
        };
        
        this.isOpen = false;
        this.sessionId = this.generateSessionId();
        this.messages = [];
        
        this.init();
    }
    
    generateSessionId() {
        return 'widget_session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }
    
    init() {
        this.createWidget();
        this.attachEventListeners();
        this.loadStyles();
    }
    
    createWidget() {
        // Create widget container
        this.widget = document.createElement('div');
        this.widget.id = 'agentic-ai-chatbot-widget';
        this.widget.innerHTML = `
            <div class="chatbot-toggle" id="chatbotToggle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                </svg>
            </div>
            
            <div class="chatbot-container" id="chatbotContainer">
                <div class="chatbot-header">
                    <div class="chatbot-title">
                        <h3>${this.options.title}</h3>
                        <p>${this.options.subtitle}</p>
                    </div>
                    <button class="chatbot-close" id="chatbotClose">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
                
                <div class="chatbot-messages" id="chatbotMessages">
                    <div class="welcome-message">
                        <p>Hi! I'm your AI sales expert. How can I help you today?</p>
                    </div>
                </div>
                
                <div class="chatbot-typing" id="chatbotTyping">
                    <div class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
                
                <div class="chatbot-input-container">
                    <input type="text" id="chatbotInput" placeholder="${this.options.placeholder}" />
                    <button id="chatbotSend">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.widget);
    }
    
    loadStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #agentic-ai-chatbot-widget {
                position: fixed;
                ${this.options.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
                ${this.options.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .chatbot-toggle {
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, ${this.options.primaryColor} 0%, ${this.options.secondaryColor} 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                transition: transform 0.3s ease;
            }
            
            .chatbot-toggle:hover {
                transform: scale(1.1);
            }
            
            .chatbot-container {
                position: absolute;
                ${this.options.position.includes('right') ? 'right: 0;' : 'left: 0;'}
                ${this.options.position.includes('bottom') ? 'bottom: 80px;' : 'top: 80px;'}
                width: 350px;
                height: 500px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                display: none;
                flex-direction: column;
                overflow: hidden;
            }
            
            .chatbot-container.open {
                display: flex;
            }
            
            .chatbot-header {
                background: linear-gradient(135deg, ${this.options.primaryColor} 0%, ${this.options.secondaryColor} 100%);
                color: white;
                padding: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .chatbot-title h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }
            
            .chatbot-title p {
                margin: 4px 0 0 0;
                font-size: 12px;
                opacity: 0.9;
            }
            
            .chatbot-close {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: background-color 0.2s ease;
            }
            
            .chatbot-close:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }
            
            .chatbot-messages {
                flex: 1;
                padding: 16px;
                overflow-y: auto;
                background: #f8fafc;
            }
            
            .message {
                margin-bottom: 12px;
                display: flex;
                align-items: flex-start;
            }
            
            .message.user {
                justify-content: flex-end;
            }
            
            .message-content {
                max-width: 80%;
                padding: 12px 16px;
                border-radius: 18px;
                font-size: 14px;
                line-height: 1.4;
                word-wrap: break-word;
            }
            
            .message.user .message-content {
                background: linear-gradient(135deg, ${this.options.primaryColor} 0%, ${this.options.secondaryColor} 100%);
                color: white;
                border-bottom-right-radius: 4px;
            }
            
            .message.assistant .message-content {
                background: white;
                color: #374151;
                border: 1px solid #e5e7eb;
                border-bottom-left-radius: 4px;
            }
            
            .welcome-message {
                text-align: center;
                color: #6b7280;
                font-size: 14px;
                padding: 20px;
            }
            
            .chatbot-typing {
                display: none;
                padding: 0 16px 8px 16px;
            }
            
            .chatbot-typing.show {
                display: block;
            }
            
            .typing-dots {
                display: flex;
                gap: 4px;
                align-items: center;
            }
            
            .typing-dots span {
                width: 8px;
                height: 8px;
                background: #9ca3af;
                border-radius: 50%;
                animation: typing 1.4s infinite ease-in-out;
            }
            
            .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
            .typing-dots span:nth-child(2) { animation-delay: -0.16s; }
            
            @keyframes typing {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }
            
            .chatbot-input-container {
                padding: 16px;
                background: white;
                border-top: 1px solid #e5e7eb;
                display: flex;
                gap: 8px;
                align-items: center;
            }
            
            #chatbotInput {
                flex: 1;
                padding: 12px 16px;
                border: 1px solid #d1d5db;
                border-radius: 24px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s ease;
            }
            
            #chatbotInput:focus {
                border-color: ${this.options.primaryColor};
            }
            
            #chatbotSend {
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, ${this.options.primaryColor} 0%, ${this.options.secondaryColor} 100%);
                border: none;
                border-radius: 50%;
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s ease;
            }
            
            #chatbotSend:hover {
                transform: scale(1.05);
            }
            
            #chatbotSend:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }
            
            @media (max-width: 480px) {
                .chatbot-container {
                    width: calc(100vw - 40px);
                    height: calc(100vh - 100px);
                    ${this.options.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
                    ${this.options.position.includes('bottom') ? 'bottom: 80px;' : 'top: 80px;'}
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    attachEventListeners() {
        const toggle = document.getElementById('chatbotToggle');
        const close = document.getElementById('chatbotClose');
        const input = document.getElementById('chatbotInput');
        const send = document.getElementById('chatbotSend');
        
        toggle.addEventListener('click', () => this.toggle());
        close.addEventListener('click', () => this.close());
        send.addEventListener('click', () => this.sendMessage());
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }
    
    toggle() {
        this.isOpen ? this.close() : this.open();
    }
    
    open() {
        this.isOpen = true;
        document.getElementById('chatbotContainer').classList.add('open');
        document.getElementById('chatbotInput').focus();
    }
    
    close() {
        this.isOpen = false;
        document.getElementById('chatbotContainer').classList.remove('open');
    }
    
    async sendMessage() {
        const input = document.getElementById('chatbotInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Clear input and disable send button
        input.value = '';
        document.getElementById('chatbotSend').disabled = true;
        
        // Add user message
        this.addMessage('user', message);
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            const response = await fetch(this.options.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    session_id: this.sessionId
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Add assistant response
            this.addMessage('assistant', data.response);
            
        } catch (error) {
            console.error('Error:', error);
            this.hideTypingIndicator();
            this.addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
        } finally {
            document.getElementById('chatbotSend').disabled = false;
        }
    }
    
    addMessage(role, content) {
        // Remove welcome message if it exists
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        const messagesContainer = document.getElementById('chatbotMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;
        
        messageDiv.appendChild(messageContent);
        messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Store message
        this.messages.push({ role, content, timestamp: new Date() });
    }
    
    showTypingIndicator() {
        document.getElementById('chatbotTyping').classList.add('show');
    }
    
    hideTypingIndicator() {
        document.getElementById('chatbotTyping').classList.remove('show');
    }
    
    // Public methods for external control
    openChat() {
        this.open();
    }
    
    closeChat() {
        this.close();
    }
    
    sendMessage(message) {
        document.getElementById('chatbotInput').value = message;
        this.sendMessage();
    }
    
    getMessages() {
        return this.messages;
    }
    
    clearMessages() {
        this.messages = [];
        document.getElementById('chatbotMessages').innerHTML = `
            <div class="welcome-message">
                <p>Hi! I'm your AI sales expert. How can I help you today?</p>
            </div>
        `;
    }
}

// Auto-initialize if script is loaded with data attributes
document.addEventListener('DOMContentLoaded', () => {
    const script = document.querySelector('script[src*="chatbot-widget.js"]');
    if (script) {
        const options = {
            apiUrl: script.dataset.apiUrl || '/chat',
            position: script.dataset.position || 'bottom-right',
            theme: script.dataset.theme || 'default',
            primaryColor: script.dataset.primaryColor || '#4f46e5',
            secondaryColor: script.dataset.secondaryColor || '#7c3aed',
            title: script.dataset.title || 'Aken from AkenoTech',
            subtitle: script.dataset.subtitle || 'Hi! I\'m Aken from AkenoTech. Let me know how I can help you transform your business with custom AI solutions today!',
            placeholder: script.dataset.placeholder || 'How can agentic AI help my business?'
        };
        
        window.agenticAIChatbot = new AgenticAIChatbotWidget(options);
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgenticAIChatbotWidget;
}
