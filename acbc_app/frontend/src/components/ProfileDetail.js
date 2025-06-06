const handleSendMessage = async () => {
    try {
        if (!messageText.trim()) {
            setError('Message cannot be empty');
            return;
        }

        const response = await fetch(`/api/messages/thread/${selectedThread.id}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({ text: messageText }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send message');
        }

        const data = await response.json();
        setMessages(prevMessages => [...prevMessages, data]);
        setMessageText('');
        setError(null);
    } catch (err) {
        console.error('Error sending message:', err);
        setError(err.message || 'Failed to send message. Please try again.');
    }
};

const handleStartConversation = async () => {
    try {
        setError(null);
        const response = await fetch(`/api/messages/thread/${profile.id}/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to start conversation');
        }

        const thread = await response.json();
        setSelectedThread(thread);
        setShowMessageModal(true);
        await fetchMessages(thread.id);
    } catch (err) {
        console.error('Error starting conversation:', err);
        setError(err.message || 'Failed to start conversation. Please try again.');
    }
};

const fetchMessages = async (threadId) => {
    try {
        setError(null);
        const response = await fetch(`/api/messages/thread/${threadId}/messages/`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch messages');
        }

        const data = await response.json();
        setMessages(data);
    } catch (err) {
        console.error('Error fetching messages:', err);
        setError(err.message || 'Failed to fetch messages. Please try again.');
    }
}; 