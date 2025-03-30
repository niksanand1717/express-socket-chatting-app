// Connect to Socket.io server
const socket = io("http://localhost:3000");

// DOM elements
const joinForm = document.getElementById("join-form");
const chatForm = document.getElementById("chat-form");
const roomInput = document.getElementById("room-input");
const usernameInput = document.getElementById("username-input");
const messageInput = document.getElementById("message-input");
const roomDisplay = document.getElementById("current-room");
const onlineUsers = document.getElementById("online-users");
const messagesContainer = document.getElementById("messages");
const switchRoomForm = document.getElementById("switch-room-form");
const newRoomInput = document.getElementById("new-room-input");
const joinFormContainer = document.getElementById("join-form-container");
const chatContainer = document.getElementById("chat-container");
const typingIndicator = document.getElementById("typing-indicator");

// Current room info
let currentRoom = "";
let currentUsername = "";

// Join room handler
joinForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const username = usernameInput.value.trim();
  const roomId = roomInput.value.trim();

  if (username && roomId) {
    // Save current username
    currentUsername = username;

    // Join room
    socket.emit("join_room", { username, roomId });

    // Update UI
    currentRoom = roomId;
    roomDisplay.textContent = `Room: ${roomId}`;

    // Hide join form, show chat interface
    joinFormContainer.classList.add("hidden");
    chatContainer.classList.remove("hidden");

    // Add welcome message
    addMessageToUI({
      userId: "system",
      username: "System",
      text: `Welcome to room ${roomId}, ${username}!`,
      time: new Date().toISOString(),
    });

    // Focus message input
    messageInput.focus();
  }
});

// Send message handler
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const message = messageInput.value.trim();

  if (message) {
    // Send message to server
    socket.emit("message", { text: message });

    // Clear input
    messageInput.value = "";
    messageInput.focus();
  }
});

// Typing indicator
let typingTimer;
messageInput.addEventListener("input", () => {
  socket.emit("typing", true);

  // Clear typing indicator after a delay
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit("typing", false);
  }, 1000);
});

// Switch room handler
switchRoomForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const newRoom = newRoomInput.value.trim();

  if (newRoom && newRoom !== currentRoom) {
    socket.emit("switch_room", newRoom);

    // Update UI
    const oldRoom = currentRoom;
    currentRoom = newRoom;
    roomDisplay.textContent = `Room: ${newRoom}`;
    newRoomInput.value = "";

    // Clear messages when switching rooms
    messagesContainer.innerHTML = "";

    // Add room change notification
    addMessageToUI({
      userId: "system",
      username: "System",
      text: `You switched from room "${oldRoom}" to room "${newRoom}"`,
      time: new Date().toISOString(),
    });

    // Focus message input
    messageInput.focus();
  }
});

// Socket event listeners
socket.on("message", (message) => {
  // Add message to UI
  addMessageToUI(message);
});

socket.on("users_list", (users) => {
  // Update online users list
  updateOnlineUsers(users);
});

socket.on("user_joined", (data) => {
  // Update online users list
  updateOnlineUsers(data.users);
});

socket.on("user_left", (data) => {
  // Update online users list
  updateOnlineUsers(data.users);
});

socket.on("user_typing", (data) => {
  // Show typing indicator
  showTypingIndicator(data);
});

socket.on("previous_messages", (previousMessages) => {
  // Display previous messages
  previousMessages.forEach((message) => {
    addPreviousMessageToUI(message);
  });
});

// UI update functions

function addPreviousMessageToUI(message) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("p-3", "rounded-lg", "break-words");

  // Different styling for different message types
  if (message.userId === "system") {
    messageElement.classList.add("system-message", "text-sm", "text-gray-600");
  } else if (message.userId === socket.id) {
    messageElement.classList.add("bg-blue-100", "ml-auto", "mr-0", "max-w-md");
  } else {
    messageElement.classList.add("bg-gray-100", "mr-auto", "ml-0", "max-w-md");
  }

  // Format message content
  messageElement.innerHTML = `
    <div class="flex justify-between items-start mb-1">
      <span class="font-medium ${
        message.userId === socket.id ? "text-blue-600" : "text-gray-800"
      }">${message.username}</span>
      <span class="text-xs text-gray-500 ml-2">${formatTime(
        message.timestamp
      )}</span>
    </div>
    <div class="${message.userId === "system" ? "italic" : ""}">${
    message.message
  }</div>
  `;

  messagesContainer.appendChild(messageElement);

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addMessageToUI(message) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("p-3", "rounded-lg", "break-words");

  // Different styling for different message types
  if (message.userId === "system") {
    messageElement.classList.add("system-message", "text-sm", "text-gray-600");
  } else if (message.userId === socket.id) {
    messageElement.classList.add("bg-blue-100", "ml-auto", "mr-0", "max-w-md");
  } else {
    messageElement.classList.add("bg-gray-100", "mr-auto", "ml-0", "max-w-md");
  }

  // Format message content
  messageElement.innerHTML = `
    <div class="flex justify-between items-start mb-1">
      <span class="font-medium ${
        message.userId === socket.id ? "text-blue-600" : "text-gray-800"
      }">${message.username}</span>
      <span class="text-xs text-gray-500 ml-2">${formatTime(
        message.time
      )}</span>
    </div>
    <div class="${message.userId === "system" ? "italic" : ""}">${
    message.text
  }</div>
  `;

  messagesContainer.appendChild(messageElement);

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateOnlineUsers(users) {
  onlineUsers.innerHTML = "";

  users.forEach((user) => {
    const userElement = document.createElement("div");
    userElement.classList.add(
      "py-2",
      "px-3",
      "rounded",
      "flex",
      "items-center"
    );

    // Highlight current user
    if (user.username === currentUsername) {
      userElement.classList.add("bg-blue-100", "text-blue-800");
    }

    // Add user icon and name
    userElement.innerHTML = `
      <div class="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
      <span class="${user.username === currentUsername ? "font-medium" : ""}">${
      user.username
    }</span>
    `;

    onlineUsers.appendChild(userElement);
  });
}

function showTypingIndicator(data) {
  if (data.isTyping) {
    typingIndicator.textContent = `${data.username} is typing...`;
    typingIndicator.classList.remove("hidden");
  } else {
    typingIndicator.classList.add("hidden");
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Handle window resize to make chat interface more responsive
window.addEventListener("resize", () => {
  if (window.innerWidth < 768) {
    // Mobile adjustments if needed
  }
});

// Prevent zoom on double-tap for mobile devices
document.addEventListener(
  "touchend",
  (e) => {
    const now = Date.now();
    const lastTouch = window.lastTouch || now + 1;
    const delta = now - lastTouch;
    if (delta < 300 && delta > 0) {
      e.preventDefault();
    }
    window.lastTouch = now;
  },
  false
);
