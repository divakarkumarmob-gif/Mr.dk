export async function chatWithAI(messages: { role: string; content: string }[], newMessage: string, imageData?: string) {
    const updatedMessages = [...messages, { role: 'user', content: newMessage }];
    
    // Note: imageData is not supported by the new backend tutor endpoint at the moment,
    // as it currently only expects messages. 
    // If image support is needed, the backend endpoint will need to be updated.

    const backendUrl = "https://mrdk.onrender.com";
    const response = await fetch(`${backendUrl}/api/tutor`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: updatedMessages }),
    });

    if (!response.ok) {
        throw new Error("Failed to get tutor response");
    }

    const data = await response.json();
    return data.reply;
}
