class Chatbot {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendButton');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.isProcessingMessage = false;
        this.openScheduleBtn = document.getElementById('openScheduleBtn');
        this.scheduleModal = document.getElementById('scheduleModal');
        this.closeScheduleBtn = document.getElementById('closeScheduleBtn');
        this.schForm = document.getElementById('chatScheduleForm');
        this.schStatus = document.getElementById('sch_status');
        this.schSubmit = document.getElementById('sch_submit');
        this.schCancel = document.getElementById('sch_cancel');
        this.schDate = document.getElementById('sch_date');
        this.schTime = document.getElementById('sch_time');

        this.initializeEventListeners();
        this.autoResizeTextarea();
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    initializeEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.chatInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });
        if (this.openScheduleBtn) {
            this.openScheduleBtn.addEventListener('click', () => this.openScheduleModal());
        }
        if (this.closeScheduleBtn) {
            this.closeScheduleBtn.addEventListener('click', () => this.closeScheduleModal());
        }
        if (this.schCancel) {
            this.schCancel.addEventListener('click', () => this.closeScheduleModal());
        }
        if (this.schForm) {
            this.schForm.addEventListener('submit', (e) => this.submitSchedule(e));
        }
    }

    autoResizeTextarea() {
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + 'px';
    }
    getApiUrl(path) {
        try {
            const { origin, protocol } = window.location;
            if (origin && protocol && protocol.startsWith('http')) {
                return `${origin}${path}`;
            }
        } catch (_) { }
        return `http://localhost:8000${path}`;
    }
    async fetchWithFallback(path, options) {
        const primaryUrl = this.getApiUrl(path);
        try {
            const res = await fetch(primaryUrl, options);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res;
        } catch (err) {
            const isPrimaryLocalhost = primaryUrl.startsWith('http://localhost:8000') || primaryUrl.startsWith('https://localhost:8000');
            if (!isPrimaryLocalhost) {
                const res = await fetch(`http://localhost:8000${path}`, options);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res;
            }
            throw err;
        }
    }
    isJsonResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        return contentType.includes('application/json');
    }
    async readJsonSafely(response) {
        if (this.isJsonResponse(response)) {
            return await response.json();
        }
        const text = await response.text();
        try { return JSON.parse(text); } catch (_) { return { response: text || 'No content' }; }
    }

    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        // If user uses quick command to schedule, open modal and do not hit backend
        if (message.toLowerCase() === '/schedule') {
            this.chatInput.value = '';
            this.autoResizeTextarea();
            this.addMessage('assistant', 'Opening the scheduling form for you...');
            await this.openScheduleModal();
            return;
        }

        // Clear input and disable send button
        this.chatInput.value = '';
        this.sendButton.disabled = true;
        this.autoResizeTextarea();

        // Add user message to chat
        this.addMessage('user', message);

        // Show typing indicator
        this.isProcessingMessage = true;
        this.showTypingIndicator();

        // If the user's message clearly asks to schedule, proactively open the modal in parallel
        if (this.isScheduleIntent(message)) {
            // Don't await to avoid blocking chat response
            this.openScheduleModal();
        }

        try {
            const response = await this.fetchWithFallback('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    session_id: this.sessionId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `HTTP ${response.status}`);
            }

            const data = await this.readJsonSafely(response);

            // Add assistant response
            this.addMessage('assistant', data.response, data.sources);

            // If assistant suggests scheduling, open the modal
            if (data && typeof data.response === 'string' && this.isScheduleIntent(data.response)) {
                this.openScheduleModal();
            }

        } catch (error) {
            console.error('Error:', error);
            this.addErrorMessage('Sorry, I encountered an error. Please try again.');
        } finally {
            this.isProcessingMessage = false;
            this.hideTypingIndicator();
            this.sendButton.disabled = false;
        }
    }
    isScheduleIntent(text) {
        const t = (text || '').toLowerCase();
        const keywords = [
            'schedule a consultation',
            'schedule consultation',
            'book a consultation',
            'book consultation',
            'schedule a call',
            'book a call',
            'schedule meeting',
            'book meeting',
            'schedule an appointment',
            'book an appointment'
        ];
        return keywords.some(k => t.includes(k));
    }

    addMessage(role, content, sources = null) {
        // Remove welcome message if it exists
        const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;

        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = new Date().toLocaleTimeString();

        messageContent.appendChild(messageTime);

        // Add sources if available
        if (sources && sources.length > 0) {
            const sourcesDiv = document.createElement('div');
            sourcesDiv.className = 'sources';
            sourcesDiv.innerHTML = '<h4>Sources:</h4>';

            sources.forEach(source => {
                const sourceItem = document.createElement('div');
                sourceItem.className = 'source-item';
                sourceItem.textContent = source.content;
                sourcesDiv.appendChild(sourceItem);
            });

            messageContent.appendChild(sourcesDiv);
        }

        messageDiv.appendChild(messageContent);
        this.chatMessages.appendChild(messageDiv);

        // Scroll to bottom
        this.scrollToBottom();
    }

    addErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        this.chatMessages.appendChild(errorDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        if (!this.isProcessingMessage) return;
        this.typingIndicator.classList.add('show');
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.typingIndicator.classList.remove('show');
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    async openScheduleModal() {
        this.scheduleModal.style.display = 'block';
        await this.loadAvailableSlots();
    }
    closeScheduleModal() {
        this.scheduleModal.style.display = 'none';
        if (this.schStatus) {
            this.schStatus.style.display = 'none';
            this.schStatus.textContent = '';
        }
    }
    async loadAvailableSlots() {
        try {
            this.schDate.disabled = true;
            this.schDate.innerHTML = '<option value="">Loading dates...</option>';
            this.schTime.innerHTML = '<option value="">Select a time</option>';
            const res = await this.fetchWithFallback('/consultation/available-slots');
            const data = await this.readJsonSafely(res);
            if (data && data.status === 'success' && data.available_slots) {
                this.schDate.innerHTML = '<option value="">Select a date</option>';
                const dates = data.available_slots.available_days || [];
                const slotsByDay = data.available_slots.available_slots_by_day || {};
                
                dates.forEach(dateStr => {
                    const [y, m, d] = (dateStr || '').split('-').map(Number);
                    const jsDate = new Date(y, (m || 1) - 1, d || 1);
                    const availableTimes = slotsByDay[dateStr] || [];
                    const opt = document.createElement('option');
                    opt.value = dateStr;
                    opt.textContent = jsDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + 
                                    ` (${availableTimes.length} slots available)`;
                    this.schDate.appendChild(opt);
                });
                
                // Add event listener to update times when date changes
                this.schDate.addEventListener('change', () => this.updateAvailableTimes(slotsByDay));
                
                // Initialize with all possible times
                const allTimes = data.available_slots.available_times || [];
                this.schTime.innerHTML = '<option value="">Select a date first</option>';
                allTimes.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t;
                    opt.textContent = t;
                    opt.disabled = true; // Disabled until date is selected
                    this.schTime.appendChild(opt);
                });
            } else {
                this.schDate.innerHTML = '<option value="">No available dates</option>';
            }
        } catch (e) {
            this.schDate.innerHTML = '<option value="">Unable to load dates</option>';
        } finally {
            this.schDate.disabled = false;
        }
    }
    
    updateAvailableTimes(slotsByDay) {
        const selectedDate = this.schDate.value;
        const availableTimes = slotsByDay[selectedDate] || [];
        
        // Clear and repopulate time options
        this.schTime.innerHTML = '<option value="">Select a time</option>';
        
        if (availableTimes.length > 0) {
            availableTimes.forEach(time => {
                const opt = document.createElement('option');
                opt.value = time;
                opt.textContent = time;
                this.schTime.appendChild(opt);
            });
        } else {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No available times for this date';
            opt.disabled = true;
            this.schTime.appendChild(opt);
        }
    }
    async submitSchedule(e) {
        e.preventDefault();
        if (!this.schForm) return;
        this.schSubmit.disabled = true;
        const payload = {
            name: document.getElementById('sch_name').value,
            email: document.getElementById('sch_email').value,
            phone: document.getElementById('sch_phone').value,
            company: document.getElementById('sch_company').value,
            preferred_date: this.schDate.value,
            preferred_time: this.schTime.value,
            message: document.getElementById('sch_msg').value
        };
        try {
            const res = await this.fetchWithFallback('/consultation/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const t = await res.text();
                throw new Error(t || `HTTP ${res.status}`);
            }
            const result = await this.readJsonSafely(res);
            if (result && result.success) {
                this.addMessage('assistant', result.message);
                this.schForm.reset();
                this.closeScheduleModal();
            } else {
                const msg = (result && (result.message || result.detail)) || 'Unknown error';
                this.showScheduleStatus(msg, true);
                
                // If it's a time slot conflict, refresh available slots
                if (result && result.message && result.message.includes('no longer available')) {
                    await this.loadAvailableSlots();
                }
            }
        } catch (err) {
            this.showScheduleStatus(err.message || 'Error scheduling consultation', true);
        } finally {
            this.schSubmit.disabled = false;
        }
    }
    showScheduleStatus(message, isError = false) {
        if (!this.schStatus) return;
        this.schStatus.style.display = 'block';
        this.schStatus.textContent = message;
        this.schStatus.style.background = isError ? '#fee2e2' : '#d1fae5';
        this.schStatus.style.color = isError ? '#991b1b' : '#065f46';
        this.schStatus.style.border = `1px solid ${isError ? '#fca5a5' : '#a7f3d0'}`;
    }
}

// Initialize chatbot when page loads
document.addEventListener('DOMContentLoaded', () => {
    new Chatbot();
});