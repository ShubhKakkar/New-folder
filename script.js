document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:5000';
    let currentUser = null;
    let postsCache = [];
    let usersCache = [];
    let onlineUsers = new Set();
    let socket = null;

    // Cloudinary configuration (replace with your actual details)
    const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dndkskewk/image/upload';
    const CLOUDINARY_UPLOAD_PRESET = 'uploads';

    // DOM Element Selectors
    const authContainer = document.getElementById('auth-container');
    const pageHeader = document.getElementById('page-header');
    const homeView = document.getElementById('home-view');
    const profileView = document.getElementById('profile-view');
    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const postsContainer = document.getElementById('posts-container');
    const suggestionsContainer = document.getElementById('suggestions-container');
    const createPostModal = document.getElementById('create-post-modal');
    const shareModal = document.getElementById('share-modal');

    // Separate Modals for Feed
    const feedSinglePostModal = document.getElementById('feed-single-post-modal');
    const feedCommentModal = document.getElementById('feed-comment-modal');

    // Separate Modals for Profile
    const profileSinglePostModal = document.getElementById('profile-single-post-modal');
    const profileCommentModal = document.getElementById('profile-comment-modal');

    const editProfileModal = document.getElementById('edit-profile-modal');
    // New Edit Post Modal
    const editPostModal = document.getElementById('edit-post-modal');
    const chatView = document.getElementById('chat-view');
    const userSearchInput = document.getElementById('user-search-input');
    const userSearchResults = document.getElementById('user-search-results');
    const conversationsList = document.getElementById('conversations-list');

    // Core App Logic
    const showView = (viewToShow) => {
        [authContainer, homeView, profileView, pageHeader, chatView].forEach(el => el.classList.add('hidden'));
        if (viewToShow === 'auth') {
            authContainer.classList.remove('hidden');
        } else {
            pageHeader.classList.remove('hidden');
            if (viewToShow === 'home') homeView.classList.remove('hidden');
            if (viewToShow === 'profile') profileView.classList.remove('hidden');
            if (viewToShow === 'chat') chatView.classList.remove('hidden');
        }
    };

    const fetchWithAuth = async (url, options = {}) => {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (token) headers['x-auth-token'] = token;
        return fetch(url, { ...options, headers });
    };

    const uploadImageToCloudinary = async (file) => {
        if (!file) return null;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        try {
            const response = await fetch(CLOUDINARY_URL, {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) throw new Error('Cloudinary upload failed.');
            const data = await response.json();
            return data.secure_url;
        } catch (error) {
            console.error('Error uploading to Cloudinary:', error);
            alert('Failed to upload image. Please try again.');
            return null;
        }
    };

    const getInitials = (user) => (user && user.username) ? user.username.charAt(0).toUpperCase() : '?';
    const getUsername = (user) => (user && user.username) ? user.username : 'unknown';
    const getProfilePic = (user, size = 32) => (user && user.profilePicture) ? user.profilePicture : `https://placehold.co/${size}x${size}/EFEFEF/AAAAAA?text=${getInitials(user)}`;

    // Re-usable comment rendering logic
    const renderComments = (comments, isReply = false) => {
        let html = '';
        comments.forEach((comment, index) => {
            if (!comment.user) {
                comment.user = { _id: 'unknown', username: 'unknown', profilePicture: '' };
            }
            const isHidden = !isReply && index > 0 ? 'hidden comment-hidden' : '';
            let commentText = comment.text;
            let readMoreHtml = '';
            if (comment.text.length > 100) {
                commentText = comment.text.substring(0, 100);
                readMoreHtml = `... <button class="text-gray-500 font-semibold text-xs read-more-comment">more</button>`;
            }
            let repliesHtml = '';
            if (comment.replies && comment.replies.length > 0) {
                repliesHtml = `
                    <div class="ml-8 mt-2">
                        <button class="text-xs text-gray-500 font-semibold view-replies-btn">View replies (${comment.replies.length})</button>
                        <div class="replies-container hidden mt-2 border-l-2 pl-3 dark:border-zinc-700">
                            ${renderComments(comment.replies, true)}
                        </div>
                    </div>`;
            }
            html += `
                <div class="comment-item ${isHidden} mb-3" data-comment-id="${comment._id}">
                    <div class="flex items-start">
                        <img src="${getProfilePic(comment.user)}" class="w-8 h-8 rounded-full object-cover">
                        <div class="ml-3 flex-1">
                            <p class="text-sm text-black dark:text-gray-200">
                                <span class="username-link font-semibold" data-user-id="${comment.user._id}">${getUsername(comment.user)}</span>
                                <span class="comment-full-text hidden">${comment.text}</span>
                                <span class="comment-short-text">${commentText}${readMoreHtml}</span>
                            </p>
                            <div class="text-xs text-gray-500 mt-1">
                                <button class="comment-reply-btn font-semibold">Reply</button>
                            </div>
                        </div>
                    </div>
                    ${repliesHtml}
                </div>`;
        });
        return html;
    };

    // Renders all comments in a modal
    const renderCommentsForModal = (comments, container) => {
        container.innerHTML = renderComments(comments, true); // Pass true to show all comments
    };

    // Renders posts for the main feed
    const renderPosts = (posts, container) => {
        container.innerHTML = '';
        posts.forEach(post => {
            if (!post.user) return;
            const isLiked = post.likes.includes(currentUser._id);
            const postEl = document.createElement('div');
            postEl.className = "bg-white dark:bg-black border border-gray-300 dark:border-zinc-800 rounded-sm feed-post-card";
            postEl.dataset.postId = post._id;

            // Show only the first comment initially
            const firstCommentHtml = renderComments(post.comments.slice(0, 1));
            const viewMoreCommentsHtml = post.comments.length > 1 ? `<p class="text-gray-500 text-sm mt-2 cursor-pointer feed-view-comments-btn">View all ${post.comments.length} comments</p>` : (post.comments.length === 1 ? `<p class="text-gray-500 text-sm mt-2 cursor-pointer feed-view-comments-btn">View 1 comment</p>` : '');

            const likeButtonClasses = `feed-like-btn ${isLiked ? 'liked' : ''}`;
            const likeButtonSvgStyle = isLiked ? 'style="fill: red; color: red;"' : '';

            postEl.innerHTML = `
                <div class="flex items-center p-4"><img src="${getProfilePic(post.user)}" class="w-8 h-8 rounded-full object-cover"><span class="ml-3 text-sm text-black dark:text-gray-200 username-link" data-user-id="${post.user._id}">${getUsername(post.user)}</span></div>
                <img src="${post.imageUrl}" onerror="this.onerror=null;this.src='https://placehold.co/600x600/cccccc/666666?text=Image+Not+Found';" class="w-full">
                <div class="p-4 text-black dark:text-gray-200">
                    <div class="flex space-x-4 mb-2"><button class="${likeButtonClasses}"><i data-lucide="heart" class="h-6 w-6" ${likeButtonSvgStyle}></i></button><button class="feed-view-comments-btn"><i data-lucide="message-circle" class="h-6 w-6"></i></button><button class="share-btn"><i data-lucide="send" class="h-6 w-6"></i></button><button class="ml-auto"><i data-lucide="bookmark" class="h-6 w-6"></i></button></div>
                    <p class="font-semibold text-sm feed-likes-count">${post.likes.length} likes</p>
                    <p class="text-sm mt-1"><span class="username-link" data-user-id="${post.user._id}">${getUsername(post.user)}</span> ${post.caption}</p>
                    <div class="text-sm mt-2 space-y-2 feed-comments-section">${firstCommentHtml}</div>
                    ${viewMoreCommentsHtml}
                </div>`;
            container.appendChild(postEl);
        });
        lucide.createIcons();
    };

    const renderProfile = (user, posts) => {
        const isFollowing = currentUser.following.includes(user._id);
        const profilePicUrl = getProfilePic(user, 150);
        const actionButtonHtml = user._id === currentUser._id ? `<button id="edit-profile-btn" class="bg-gray-100 dark:bg-zinc-800 font-semibold text-sm px-2 py-1 rounded border border-gray-300 dark:border-zinc-700">Edit Profile</button>` : `<button class="follow-btn action-button enabled px-4 py-1 text-sm" data-user-id="${user._id}">${isFollowing ? 'Following' : 'Follow'}</button>`;
        profileView.innerHTML = `
            <main class="container mx-auto max-w-4xl p-4 md:p-8 text-black dark:text-gray-200">
                <header class="flex flex-col md:flex-row items-center md:items-start mb-8"><div class="w-20 h-20 md:w-36 md:h-36 flex-shrink-0 mr-0 md:mr-16"><img src="${profilePicUrl}" class="rounded-full w-full h-full object-cover"></div><section class="text-center md:text-left mt-4 md:mt-0"><div class="flex items-center justify-center md:justify-start space-x-4 mb-4"><h2 class="text-2xl font-light">${getUsername(user)}</h2> ${actionButtonHtml} <button><i data-lucide="settings" class="h-6 w-6"></i></button></div><div class="flex justify-center md:justify-start space-x-8 mb-4"><div><span class="font-semibold">${posts.length}</span> posts</div><div><span class="font-semibold" id="follower-count">${user.followers.length}</span> followers</div><div><span class="font-semibold">${user.following.length}</span> following</div></div><div><h1 class="font-semibold">${user.fullName}</h1><p class="text-gray-500 dark:text-gray-400 whitespace-pre-wrap">${user.bio || 'No bio yet.'}</p></div></section></header>
                <div class="border-t border-gray-300 dark:border-zinc-800"><div class="flex justify-center text-gray-500 dark:text-gray-400 text-sm font-semibold -mt-px"><a href="#" class="profile-tab active flex items-center space-x-2 p-3 text-black dark:text-gray-200"><i data-lucide="grid-3x3"></i><span>POSTS</span></a></div></div>
                <div id="profile-posts-grid" class="grid grid-cols-3 gap-1 md:gap-4"></div>
            </main>`;
        const profilePostsGrid = document.getElementById('profile-posts-grid');
        posts.forEach(post => {
            const postEl = document.createElement('div');
            postEl.className = "relative group profile-post-item";
            postEl.dataset.postId = post._id;
            const isLiked = post.likes.includes(currentUser._id);
            const likeIconStyle = isLiked ? 'style="fill: red; color: red;"' : '';
            // console.log(post)
            const isOwner = post.user._id === currentUser._id;
            
            let ownerButtons = '';
            if (isOwner) {
                ownerButtons = `
                    <div class="absolute top-2 right-2 z-10">
                        <div class="relative">
                            <button class="post-options-btn text-white"><i data-lucide="more-horizontal" class="h-5 w-5"></i></button>
                            <div class="post-options-dropdown hidden absolute right-0 mt-2 w-32 bg-white dark:bg-zinc-800 rounded-md shadow-lg py-1 z-20">
                                <button class="edit-post-btn block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700" data-post-id="${post._id}">Edit</button>
                                <button class="delete-post-btn block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-zinc-700" data-post-id="${post._id}">Delete</button>
                            </div>
                        </div>
                    </div>
                `;
            }

            postEl.innerHTML = `${ownerButtons}<img src="${post.imageUrl}" onerror="this.onerror=null;this.src='https://placehold.co/300x300/cccccc/666666?text=Post';" class="w-full h-full object-cover aspect-square cursor-pointer"><div class="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center space-x-4 text-white opacity-0 group-hover:opacity-100 transition-opacity"><span class="flex items-center"><i data-lucide="heart" class="h-5 w-5 mr-1" ${likeIconStyle}></i>${post.likes.length}</span><span class="flex items-center"><i data-lucide="message-circle" class="h-5 w-5 mr-1"></i>${post.comments.length}</span></div>`;
            profilePostsGrid.appendChild(postEl);
        });
        lucide.createIcons();
    };

    const renderSuggestions = (users) => {
        suggestionsContainer.innerHTML = '';
        users.slice(0, 5).forEach(user => {
            const isFollowing = currentUser.following.includes(user._id);
            const suggestionEl = document.createElement('div');
            suggestionEl.className = "flex items-center";
            suggestionEl.innerHTML = `
                <img src="${getProfilePic(user)}" class="w-8 h-8 rounded-full object-cover">
                <div class="ml-3"><p class="font-semibold text-sm text-black dark:text-gray-200 username-link" data-user-id="${user._id}">${getUsername(user)}</p><p class="text-gray-400 text-xs">Suggested for you</p></div>
                <button class="follow-btn ml-auto text-blue-500 font-semibold text-xs" data-user-id="${user._id}">${isFollowing ? 'Following' : 'Follow'}</button>`;
            suggestionsContainer.appendChild(suggestionEl);
        });
    };

    const renderConversations = (users) => {
        conversationsList.innerHTML = '';
        users.forEach(user => {
            if (user._id === currentUser._id) return;
            const profilePic = getProfilePic(user, 40);
            const userEl = document.createElement('div');
            userEl.className = "flex items-center p-4 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer conversation-item";
            userEl.dataset.userId = user._id;
            userEl.dataset.username = user.username;
            userEl.dataset.profilePic = profilePic;
            const isOnline = onlineUsers.has(user._id);
            userEl.innerHTML = `
                <div class="relative">
                    <img src="${profilePic}" class="w-10 h-10 rounded-full object-cover">
                    ${isOnline ? '<span class="online-indicator"></span>' : ''}
                </div>
                <span class="ml-3 text-black dark:text-white">${user.username}</span>`;
            conversationsList.appendChild(userEl);
        });
    };

    const renderUserSearchResults = (users) => {
        userSearchResults.innerHTML = '';
        if (users.length === 0) {
            userSearchResults.classList.add('hidden');
            return;
        }
        users.forEach(user => {
            const resultEl = document.createElement('a');
            resultEl.href = '#';
            resultEl.className = "flex items-center p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 username-link";
            resultEl.dataset.userId = user._id;
            resultEl.innerHTML = `
                <img src="${getProfilePic(user)}" class="w-8 h-8 rounded-full object-cover">
                <div class="ml-3">
                    <p class="text-sm font-semibold text-black dark:text-white">${user.username}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${user.fullName}</p>
                </div>
            `;
            userSearchResults.appendChild(resultEl);
        });
        userSearchResults.classList.remove('hidden');
    };

    // Renders single post modal for feed posts
    const renderSinglePostFeedModal = (post) => {
        const postContent = document.getElementById('feed-single-post-dynamic-area');
        const isLiked = post.likes.includes(currentUser._id);
        const commentsHtml = renderComments(post.comments);
        const likeButtonClasses = `feed-like-btn ${isLiked ? 'liked' : ''}`;
        const likeButtonSvgStyle = isLiked ? 'style="fill: red; color: red;"' : '';
        postContent.innerHTML = `
            <div class="w-1/2 bg-black flex items-center justify-center"><img src="${post.imageUrl}" class="max-h-full max-w-full"></div>
            <div class="w-1/2 flex flex-col p-4 text-black dark:text-white">
                <div class="flex items-center pb-4 border-b border-gray-200 dark:border-zinc-700">
                    <img src="${getProfilePic(post.user)}" class="w-8 h-8 rounded-full object-cover">
                    <span class="ml-3 username-link" data-user-id="${post.user._id}">${getUsername(post.user)}</span>
                </div>
                <div class="flex-grow overflow-y-auto py-4 space-y-4 feed-comments-section">${commentsHtml}</div>
                <div class="pt-4 border-t border-gray-200 dark:border-zinc-700 feed-post-card" data-post-id="${post._id}">
                    <div class="flex space-x-4 mb-2">
                        <button class="${likeButtonClasses}"><i data-lucide="heart" class="h-6 w-6" ${likeButtonSvgStyle}></i></button>
                        <button class="feed-view-comments-btn"><i data-lucide="message-circle" class="h-6 w-6"></i></button>
                        <button class="share-btn"><i data-lucide="send" class="h-6 w-6"></i></button>
                        <button class="ml-auto"><i data-lucide="bookmark" class="h-6 w-6"></i></button>
                    </div>
                    <p class="font-semibold text-sm feed-likes-count">${post.likes.length} likes</p>
                    <form id="single-post-feed-comment-form" class="comment-form flex items-center mt-2 border-t border-gray-200 dark:border-zinc-800 pt-2 relative">
                        <button type="button" class="absolute right-12 text-gray-500 feed-single-post-emoji-btn">😊</button>
                        <input type="text" placeholder="Add a comment..." class="feed-comment-input w-full text-sm border-none focus:ring-0 bg-transparent dark:text-gray-200">
                        <button type="submit" class="text-blue-500 font-semibold text-sm">Post</button>
                    </form>
                    <emoji-picker class="feed-single-post-emoji-picker hidden w-full"></emoji-picker>
                </div>
            </div>`;
        feedSinglePostModal.classList.replace('hidden', 'flex');
        lucide.createIcons();
    };

    // Renders single post modal for profile posts
    const renderSinglePostProfileModal = (post) => {
        const postContent = document.getElementById('profile-single-post-dynamic-area');
        const isLiked = post.likes.includes(currentUser._id);
        const commentsHtml = renderComments(post.comments, true);
        const likeButtonClasses = `profile-like-btn ${isLiked ? 'liked' : ''}`;
        const likeButtonSvgStyle = isLiked ? 'style="fill: red; color: red;"' : '';
        postContent.innerHTML = `
            <div class="w-1/2 bg-black flex items-center justify-center"><img src="${post.imageUrl}" class="max-h-full max-w-full"></div>
            <div class="w-1/2 flex flex-col p-4 text-black dark:text-white">
                <div class="flex items-center pb-4 border-b border-gray-200 dark:border-zinc-700">
                    <img src="${getProfilePic(post.user)}" class="w-8 h-8 rounded-full object-cover">
                    <span class="ml-3 username-link" data-user-id="${post.user._id}">${getUsername(post.user)}</span>
                </div>
                <div class="flex-grow overflow-y-auto py-4 space-y-4 profile-comments-section">${commentsHtml}</div>
                <div class="pt-4 border-t border-gray-200 dark:border-zinc-700 profile-post-card" data-post-id="${post._id}">
                    <div class="flex space-x-4 mb-2">
                        <button class="${likeButtonClasses}"><i data-lucide="heart" class="h-6 w-6" ${likeButtonSvgStyle}></i></button>
                        <button class="profile-view-comments-btn"><i data-lucide="message-circle" class="h-6 w-6"></i></button>
                        <button class="share-btn"><i data-lucide="send" class="h-6 w-6"></i></button>
                        <button class="ml-auto"><i data-lucide="bookmark" class="h-6 w-6"></i></button>
                    </div>
                    <p class="font-semibold text-sm profile-likes-count">${post.likes.length} likes</p>
                    <form id="single-post-profile-comment-form" class="comment-form flex items-center mt-2 border-t border-gray-200 dark:border-zinc-800 pt-2 relative">
                        <button type="button" class="absolute right-12 text-gray-500 profile-single-post-emoji-btn">😊</button>
                        <input type="text" placeholder="Add a comment..." class="profile-comment-input w-full text-sm border-none focus:ring-0 bg-transparent dark:text-gray-200">
                        <button type="submit" class="text-blue-500 font-semibold text-sm">Post</button>
                    </form>
                    <emoji-picker class="profile-single-post-emoji-picker hidden w-full"></emoji-picker>
                </div>
            </div>`;
        profileSinglePostModal.classList.replace('hidden', 'flex');
        lucide.createIcons();
    };


    const initializeApp = async () => {
        const token = localStorage.getItem('token');
        if (!token) { showView('auth'); return; }
        try {
            const userRes = await fetchWithAuth(`${API_URL}/api/auth/me`);
            if (!userRes.ok) throw new Error('Session expired. Please log in again.');
            currentUser = await userRes.json();
            const profilePicUrl = getProfilePic(currentUser, 56);
            document.getElementById('sidebar-profile-pic').src = profilePicUrl;
            document.getElementById('header-profile-pic').src = profilePicUrl.replace('56x56', '24x24');
            document.getElementById('sidebar-username').textContent = getUsername(currentUser);
            document.getElementById('sidebar-fullname').textContent = currentUser.fullName;
            if (!socket) {
                socket = io(API_URL);
                socket.on('connect', () => {
                    socket.emit('joinRoom', currentUser._id);
                });
                socket.on('onlineUsers', (users) => {
                    onlineUsers = new Set(users);
                    if (chatView.classList.contains('hidden')) return;
                    renderConversations(usersCache);
                });
                socket.on('userStatusUpdate', (data) => {
                    if (data.online) {
                        onlineUsers.add(data.userId);
                    } else {
                        onlineUsers.delete(data.userId);
                    }
                    if (chatView.classList.contains('hidden')) return;
                    renderConversations(usersCache);
                });
                socket.on('receiveMessage', (message) => {
                    const chatWindow = document.getElementById('message-window');
                    if (chatWindow.dataset.userId === message.senderId._id) {
                        const messageEl = document.createElement('div');
                        messageEl.textContent = message.message;
                        const isSender = msg.senderId._id === currentUser._id;
                        messageEl.className = `p-2 rounded-lg max-w-xs mb-2 ${isSender ? 'bg-blue-500 text-white self-end' : 'bg-gray-200 dark:bg-zinc-700 dark:text-gray-200 self-start'}`;
                        document.getElementById('messages-container').prepend(messageEl);
                    }
                });
            }
            const [postsRes, usersRes] = await Promise.all([
                fetchWithAuth(`${API_URL}/api/posts`),
                fetchWithAuth(`${API_URL}/api/users`)
            ]);
            postsCache = await postsRes.json();
            usersCache = await usersRes.json();
            renderPosts(postsCache, postsContainer);
            renderSuggestions(usersCache);
            showView('home');
        } catch (error) {
            console.error('Initialization failed:', error);
            localStorage.removeItem('token');
            showView('auth');
        }
    };

    document.body.addEventListener('click', async (e) => {
        try {
            const likeBtn = e.target.closest('.feed-like-btn, .profile-like-btn');
            const shareBtn = e.target.closest('.share-btn');
            const followBtn = e.target.closest('.follow-btn');
            const usernameLink = e.target.closest('.username-link');
            const profilePostItem = e.target.closest('.profile-post-item');
            const sidebarProfileLink = e.target.closest('#sidebar-profile-link');
            const editProfileBtn = e.target.closest('#edit-profile-btn');
            const conversationItem = e.target.closest('.conversation-item');
            const feedViewCommentsBtn = e.target.closest('.feed-view-comments-btn');
            const profileViewCommentsBtn = e.target.closest('.profile-view-comments-btn');
            const commentReplyBtn = e.target.closest('.comment-reply-btn');
            const readMoreBtn = e.target.closest('.read-more-comment');
            const viewRepliesBtn = e.target.closest('.view-replies-btn');
            const feedSinglePostEmojiBtn = e.target.closest('.feed-single-post-emoji-btn');
            const profileSinglePostEmojiBtn = e.target.closest('.profile-single-post-emoji-btn');
            const feedCommentEmojiBtn = e.target.closest('#feed-comment-emoji-picker-btn');
            const profileCommentEmojiBtn = e.target.closest('#profile-comment-emoji-picker-btn');
            const profileEmojiBtn = e.target.closest('#emoji-picker-btn');
            const createPostEmojiBtn = e.target.closest('#create-post-emoji-btn'); // New
            const searchResultItem = e.target.closest('#user-search-results .username-link');
            const postOptionsBtn = e.target.closest('.post-options-btn');
            const editPostBtn = e.target.closest('.edit-post-btn');
            const deletePostBtn = e.target.closest('.delete-post-btn');

            // Find all active post options dropdowns
            const allDropdowns = document.querySelectorAll('.post-options-dropdown:not(.hidden)');

            if (postOptionsBtn) {
                e.stopPropagation();
                const dropdown = postOptionsBtn.closest('.relative').querySelector('.post-options-dropdown');
                // Close other dropdowns before opening the new one
                allDropdowns.forEach(d => {
                    if (d !== dropdown) {
                        d.classList.add('hidden');
                    }
                });
                dropdown.classList.toggle('hidden');
            } else if (allDropdowns.length > 0 && !e.target.closest('.post-options-dropdown')) {
                // If a click happens outside of any dropdown or its toggle button, close all dropdowns
                allDropdowns.forEach(d => d.classList.add('hidden'));
            }

            if (likeBtn) {
                const postCard = likeBtn.closest('.feed-post-card, .profile-post-card');
                if (!postCard) return;
                const postId = postCard.dataset.postId;
                try {
                    const res = await fetchWithAuth(`${API_URL}/api/posts/like/${postId}`, { method: 'PUT' });
                    if (!res.ok) throw new Error('Like failed');
                    const newLikes = await res.json();
                    document.querySelectorAll(`.feed-post-card[data-post-id="${postId}"] .feed-likes-count, .profile-post-card[data-post-id="${postId}"] .profile-likes-count`).forEach(el => {
                        el.textContent = `${newLikes.length} likes`;
                    });
                    document.querySelectorAll(`.feed-post-card[data-post-id="${postId}"] .feed-like-btn, .profile-post-card[data-post-id="${postId}"] .profile-like-btn`).forEach(btn => {
                        btn.classList.toggle('liked');
                        const heartIcon = btn.querySelector('svg');
                        if (heartIcon) {
                            if (btn.classList.contains('liked')) {
                                heartIcon.style.fill = 'red';
                                heartIcon.style.color = 'red';
                            } else {
                                heartIcon.style.fill = 'none';
                                heartIcon.style.color = 'currentColor';
                            }
                        }
                    });
                } catch (error) { console.error(error); }
            }

            if (shareBtn) { e.preventDefault(); shareModal.classList.replace('hidden', 'flex'); }

            if (followBtn) {
                const userId = followBtn.dataset.userId;
                try {
                    const res = await fetchWithAuth(`${API_URL}/api/users/follow/${userId}`, { method: 'PUT' });
                    if (!res.ok) throw new Error('Follow action failed');
                    currentUser = await res.json();
                    document.querySelectorAll(`.follow-btn[data-user-id="${userId}"]`).forEach(btn => {
                        btn.textContent = currentUser.following.includes(userId) ? 'Following' : 'Follow';
                    });
                    const followerCountEl = document.getElementById('follower-count');
                    if (followerCountEl && profileView.dataset.userId === userId) {
                        const userRes = await fetchWithAuth(`${API_URL}/api/users/${userId}`);
                        const updatedUser = await userRes.json();
                        followerCountEl.textContent = updatedUser.followers.length;
                    }
                } catch (error) { console.error(error); }
            }

            if (usernameLink || sidebarProfileLink || searchResultItem) {
                const userId = usernameLink?.dataset.userId || sidebarProfileLink?.dataset.userId || searchResultItem?.dataset.userId || currentUser._id;
                try {
                    const [userRes, postsRes] = await Promise.all([
                        fetchWithAuth(`${API_URL}/api/users/${userId}`),
                        fetchWithAuth(`${API_URL}/api/posts/user/${userId}`)
                    ]);
                    if (!userRes.ok || !postsRes.ok) throw new Error("Could not fetch user profile.");
                    const user = await userRes.json();
                    const posts = await postsRes.json();
                    profileView.dataset.userId = userId;
                    renderProfile(user, posts);
                    showView('profile');
                    userSearchResults.classList.add('hidden');
                } catch (error) { alert(error.message); }
            }
            
            // This event handler is for opening the post modal on image click
            if (profilePostItem) {
                // Ensure the click is not on the options button
                if (!e.target.closest('.post-options-btn')) {
                    const postId = profilePostItem.dataset.postId;
                    const post = postsCache.find(p => p._id === postId);
                    if (post) renderSinglePostProfileModal(post);
                }
            }

            if (editProfileBtn) {
                document.getElementById('editFullName').value = currentUser.fullName;
                document.getElementById('editBio').value = currentUser.bio;
                editProfileModal.classList.replace('hidden', 'flex');
            }

            if (conversationItem) {
                const userId = conversationItem.dataset.userId;
                const username = conversationItem.dataset.username;
                const profilePic = conversationItem.dataset.profilePic;
                document.getElementById('chat-placeholder').classList.add('hidden');
                const messageWindow = document.getElementById('message-window');
                messageWindow.classList.remove('hidden');
                messageWindow.dataset.userId = userId;
                document.getElementById('message-header').innerHTML = `<img src="${profilePic}" class="w-8 h-8 rounded-full object-cover"><span class="ml-3 font-semibold text-black dark:text-white">${username}</span>`;
                const messagesContainer = document.getElementById('messages-container');
                messagesContainer.innerHTML = '';
                try {
                    const res = await fetchWithAuth(`${API_URL}/api/messages/${userId}`);
                    const messages = await res.json();
                    messages.reverse().forEach(msg => {
                        const messageEl = document.createElement('div');
                        messageEl.textContent = msg.message;
                        const isSender = msg.senderId._id === currentUser._id;
                        messageEl.className = `p-2 rounded-lg max-w-xs mb-2 ${isSender ? 'bg-blue-500 text-white self-end' : 'bg-gray-200 dark:bg-zinc-700 dark:text-gray-200 self-start'}`;
                        messagesContainer.appendChild(messageEl);
                    });
                } catch (error) {
                    console.error("Failed to fetch message history:", error);
                }
            }

            if (feedViewCommentsBtn) {
                const postCard = feedViewCommentsBtn.closest('.feed-post-card, .feed-single-post-dynamic-area');
                if (!postCard) return;
                const postId = postCard.dataset.postId;
                const post = postsCache.find(p => p._id === postId);
                if (post) {
                    const commentList = document.getElementById('feed-comment-modal-list');
                    renderCommentsForModal(post.comments, commentList);
                    document.getElementById('feed-modal-comment-form').dataset.postId = postId;
                    feedCommentModal.classList.replace('hidden', 'flex');
                }
            }

            if (profileViewCommentsBtn) {
                const postCard = profileViewCommentsBtn.closest('.profile-post-card, .profile-single-post-dynamic-area');
                if (!postCard) return;
                const postId = postCard.dataset.postId;
                const post = postsCache.find(p => p._id === postId);
                if (post) {
                    const commentList = document.getElementById('profile-comment-modal-list');
                    renderCommentsForModal(post.comments, commentList);
                    document.getElementById('profile-modal-comment-form').dataset.postId = postId;
                    profileCommentModal.classList.replace('hidden', 'flex');
                }
            }

            if (commentReplyBtn) {
                const commentItem = commentReplyBtn.closest('.comment-item');
                if (!commentItem) return;
                const modal = commentItem.closest('.modal-backdrop');

                if (modal.id === 'feed-comment-modal') {
                    const postId = modal.querySelector('#feed-modal-comment-form').dataset.postId;
                    const post = postsCache.find(p => p._id === postId);
                    if (post) {
                        const modalCommentForm = document.getElementById('feed-modal-comment-form');
                        const modalCommentInput = document.getElementById('feed-modal-comment-input');
                        modalCommentForm.dataset.parentId = commentItem.dataset.commentId;
                        modalCommentInput.placeholder = `Replying to ${commentItem.querySelector('.username-link').textContent}...`;
                        modalCommentInput.focus();
                    }
                } else if (modal.id === 'profile-comment-modal') {
                    const postId = modal.querySelector('#profile-modal-comment-form').dataset.postId;
                    const post = postsCache.find(p => p._id === postId);
                    if (post) {
                        const modalCommentForm = document.getElementById('profile-modal-comment-form');
                        const modalCommentInput = document.getElementById('profile-modal-comment-input');
                        modalCommentForm.dataset.parentId = commentItem.dataset.commentId;
                        modalCommentInput.placeholder = `Replying to ${commentItem.querySelector('.username-link').textContent}...`;
                        modalCommentInput.focus();
                    }
                } else if (modal.id === 'feed-single-post-modal') {
                    const commentForm = document.getElementById('single-post-feed-comment-form');
                    const commentInput = commentForm.querySelector('.feed-comment-input');
                    commentForm.dataset.parentId = commentItem.dataset.commentId;
                    commentInput.placeholder = `Replying to ${commentItem.querySelector('.username-link').textContent}...`;
                    commentInput.focus();
                } else if (modal.id === 'profile-single-post-modal') {
                    const commentForm = document.getElementById('single-post-profile-comment-form');
                    const commentInput = commentForm.querySelector('.profile-comment-input');
                    commentForm.dataset.parentId = commentItem.dataset.commentId;
                    commentInput.placeholder = `Replying to ${commentItem.querySelector('.username-link').textContent}...`;
                    commentInput.focus();
                }
            }

            if (readMoreBtn) {
                const commentTextP = readMoreBtn.closest('p');
                commentTextP.querySelector('.comment-short-text').classList.add('hidden');
                commentTextP.querySelector('.comment-full-text').classList.remove('hidden');
            }

            if (viewRepliesBtn) {
                const repliesContainer = viewRepliesBtn.nextElementSibling;
                repliesContainer.classList.toggle('hidden');
                viewRepliesBtn.textContent = repliesContainer.classList.contains('hidden') ? `View replies (${repliesContainer.children.length})` : 'Hide replies';
            }

            // Refactored Emoji Button Logic
            if (feedSinglePostEmojiBtn) {
                const form = feedSinglePostEmojiBtn.closest('form');
                const emojiPicker = form.nextElementSibling;
                if (emojiPicker) emojiPicker.classList.toggle('hidden');
            }
            if (profileSinglePostEmojiBtn) {
                const form = profileSinglePostEmojiBtn.closest('form');
                const emojiPicker = form.nextElementSibling;
                if (emojiPicker) emojiPicker.classList.toggle('hidden');
            }
            if (feedCommentEmojiBtn) {
                document.getElementById('feed-comment-emoji-picker').classList.toggle('hidden');
            }
            if (profileCommentEmojiBtn) {
                document.getElementById('profile-comment-emoji-picker').classList.toggle('hidden');
            }
            if (profileEmojiBtn) {
                editProfileModal.querySelector('emoji-picker').classList.toggle('hidden');
            }
            if (createPostEmojiBtn) {
                document.getElementById('create-post-emoji-picker').classList.toggle('hidden');
            }
            
            if (editPostBtn) {
                e.stopPropagation(); // Prevent the click from bubbling up
                const postId = editPostBtn.dataset.postId;
                const postToEdit = postsCache.find(p => p._id === postId);
                if (postToEdit) {
                    document.getElementById('editPostId').value = postToEdit._id;
                    document.getElementById('editPostCaption').value = postToEdit.caption;
                    editPostModal.classList.replace('hidden', 'flex');
                }
            }

            if (deletePostBtn) {
                e.stopPropagation(); // Prevent the click from bubbling up
                const postId = deletePostBtn.dataset.postId;
                if (confirm('Are you sure you want to delete this post?')) {
                    try {
                        const res = await fetchWithAuth(`${API_URL}/api/posts/${postId}`, { method: 'DELETE' });
                        if (!res.ok) throw new Error('Failed to delete post.');
                        // Remove the post from the UI and cache
                        postsCache = postsCache.filter(p => p._id !== postId);
                        const userPostsRes = await fetchWithAuth(`${API_URL}/api/posts/user/${currentUser._id}`);
                        const userPosts = await userPostsRes.json();
                        renderProfile(currentUser, userPosts);
                    } catch (error) {
                        console.error(error);
                        alert('Failed to delete post.');
                    }
                }
            }
        } catch (error) {
            console.error("An error occurred in a click event handler:", error);
            // Optionally, you could display a user-friendly error message here.
        }
    });

    document.body.addEventListener('submit', async (e) => {
        try {
            const createPostForm = e.target.closest('#createPostForm');
            const editProfileForm = e.target.closest('#editProfileForm');
            const loginForm = e.target.closest('#loginForm');
            const signupForm = e.target.closest('#signupForm');
            const messageForm = e.target.closest('#message-form');
            const editPostForm = e.target.closest('#editPostForm');

            // Separate single post comment forms
            const singlePostFeedCommentForm = e.target.closest('#single-post-feed-comment-form');
            const singlePostProfileCommentForm = e.target.closest('#single-post-profile-comment-form');

            // Separate comment modal forms
            const feedModalCommentForm = e.target.closest('#feed-modal-comment-form');
            const profileModalCommentForm = e.target.closest('#profile-modal-comment-form');

            if (singlePostFeedCommentForm) {
                e.preventDefault();
                const postCard = singlePostFeedCommentForm.closest('.feed-post-card, .feed-single-post-dynamic-area');
                const postId = postCard.dataset.postId;
                const input = singlePostFeedCommentForm.querySelector('.feed-comment-input');
                const text = input.value;
                const parentId = singlePostFeedCommentForm.dataset.parentId;
                if (!text) return;
                try {
                    const res = await fetchWithAuth(`${API_URL}/api/posts/comment/${postId}`, { method: 'POST', body: JSON.stringify({ text, parentId }) });
                    if (!res.ok) throw new Error('Comment failed');
                    const updatedComments = await res.json();

                    const postIndex = postsCache.findIndex(p => p._id === postId);
                    if (postIndex !== -1) {
                        postsCache[postIndex].comments = updatedComments;
                    }

                    input.value = '';
                    delete singlePostFeedCommentForm.dataset.parentId;
                    input.placeholder = 'Add a comment...';

                    // Re-render feed and the modal
                    renderPosts(postsCache, postsContainer);
                    const modalCommentsSection = document.querySelector('#feed-single-post-dynamic-area .feed-comments-section');
                    if (modalCommentsSection) {
                        renderCommentsForModal(updatedComments, modalCommentsSection);
                        lucide.createIcons();
                    }

                } catch (error) { console.error(error); }
            }
            else if (singlePostProfileCommentForm) {
                e.preventDefault();
                const postCard = singlePostProfileCommentForm.closest('.profile-post-card, .profile-single-post-dynamic-area');
                const postId = postCard.dataset.postId;
                const input = singlePostProfileCommentForm.querySelector('.profile-comment-input');
                const text = input.value;
                const parentId = singlePostProfileCommentForm.dataset.parentId;
                if (!text) return;
                try {
                    const res = await fetchWithAuth(`${API_URL}/api/posts/comment/${postId}`, { method: 'POST', body: JSON.stringify({ text, parentId }) });
                    if (!res.ok) throw new Error('Comment failed');
                    const updatedComments = await res.json();

                    const postIndex = postsCache.findIndex(p => p._id === postId);
                    if (postIndex !== -1) {
                        postsCache[postIndex].comments = updatedComments;
                    }

                    input.value = '';
                    delete singlePostProfileCommentForm.dataset.parentId;
                    input.placeholder = 'Add a comment...';

                    const modalCommentsSection = document.querySelector('#profile-single-post-dynamic-area .profile-comments-section');
                    if (modalCommentsSection) {
                        renderCommentsForModal(updatedComments, modalCommentsSection);
                        lucide.createIcons();
                    }

                } catch (error) { console.error(error); }
            }
            else if (feedModalCommentForm) {
                e.preventDefault();
                const postId = feedModalCommentForm.dataset.postId;
                const input = document.getElementById('feed-modal-comment-input');
                const text = input.value;
                const parentId = feedModalCommentForm.dataset.parentId;
                if (!text) return;
                try {
                    const res = await fetchWithAuth(`${API_URL}/api/posts/comment/${postId}`, { method: 'POST', body: JSON.stringify({ text, parentId }) });
                    if (!res.ok) throw new Error('Comment failed');
                    const updatedComments = await res.json();

                    const postIndex = postsCache.findIndex(p => p._id === postId);
                    if (postIndex !== -1) {
                        postsCache[postIndex].comments = updatedComments;
                    }

                    input.value = '';
                    input.placeholder = 'Add a comment...';
                    delete feedModalCommentForm.dataset.parentId;
                    renderCommentsForModal(updatedComments, document.getElementById('feed-comment-modal-list'));
                    renderPosts(postsCache, postsContainer);
                } catch (error) { console.error(error); }
            }
            else if (profileModalCommentForm) {
                e.preventDefault();
                const postId = profileModalCommentForm.dataset.postId;
                const input = document.getElementById('profile-modal-comment-input');
                const text = input.value;
                const parentId = profileModalCommentForm.dataset.parentId;
                if (!text) return;
                try {
                    const res = await fetchWithAuth(`${API_URL}/api/posts/comment/${postId}`, { method: 'POST', body: JSON.stringify({ text, parentId }) });
                    if (!res.ok) throw new Error('Comment failed');
                    const updatedComments = await res.json();

                    const postIndex = postsCache.findIndex(p => p._id === postId);
                    if (postIndex !== -1) {
                        postsCache[postIndex].comments = updatedComments;
                    }

                    input.value = '';
                    input.placeholder = 'Add a comment...';
                    delete profileModalCommentForm.dataset.parentId;
                    renderCommentsForModal(updatedComments, document.getElementById('profile-comment-modal-list'));
                } catch (error) { console.error(error); }
            }
            else if (createPostForm) {
                e.preventDefault();
                const createPostButton = document.getElementById('createPostButton');
                const imageFile = document.getElementById('postImageFile').files[0];
                const caption = document.getElementById('postCaption').value;

                if (!imageFile) {
                    alert('Please select an image to upload.');
                    return;
                }

                // Disable the button immediately
                createPostButton.disabled = true;
                createPostButton.textContent = 'Sharing...';

                try {
                    const imageUrl = await uploadImageToCloudinary(imageFile);
                    if (!imageUrl) return;

                    const res = await fetchWithAuth(`${API_URL}/api/posts`, {
                        method: 'POST',
                        body: JSON.stringify({ imageUrl, caption }),
                    });
                    if (!res.ok) throw new Error('Failed to create post');
                    
                    createPostModal.classList.replace('flex', 'hidden');
                    initializeApp();
                } catch (error) {
                    alert(error.message);
                } finally {
                    // Re-enable the button regardless of success or failure
                    createPostButton.disabled = false;
                    createPostButton.textContent = 'Share';
                }
            }
            else if (editPostForm) {
                e.preventDefault();
                const postId = document.getElementById('editPostId').value;
                const caption = document.getElementById('editPostCaption').value;
                const imageFile = document.getElementById('editPostImageFile').files[0];

                let imageUrl = null;
                if (imageFile) {
                    imageUrl = await uploadImageToCloudinary(imageFile);
                    if (!imageUrl) return;
                }
                
                try {
                    console.log('Updating post:', postId, caption, imageUrl);
                    const res = await fetchWithAuth(`${API_URL}/api/posts/${postId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ caption, imageUrl }),
                    });
                    if (!res.ok) throw new Error('Failed to update post.');
                    
                    editPostModal.classList.replace('flex', 'hidden');
                    // Re-fetch all posts to update the UI
                    initializeApp();
                } catch (error) {
                    console.error(error);
                    alert('Failed to update post.');
                }
            }
            else if (editProfileForm) {
                e.preventDefault();
                const fullName = document.getElementById('editFullName').value;
                const bio = document.getElementById('editBio').value;
                const profilePictureFile = document.getElementById('editProfilePictureFile').files[0];

                let profilePictureUrl = currentUser.profilePicture;

                if (profilePictureFile) {
                    profilePictureUrl = await uploadImageToCloudinary(profilePictureFile);
                    if (!profilePictureUrl) return;
                }

                try {
                    const res = await fetchWithAuth(`${API_URL}/api/auth/update`, { method: 'PUT', body: JSON.stringify({ fullName, bio, profilePicture: profilePictureUrl }) });
                    if (!res.ok) throw new Error('Failed to update profile');
                    currentUser = await res.json();
                    editProfileModal.classList.replace('flex', 'hidden');
                    const postsRes = await fetchWithAuth(`${API_URL}/api/posts/user/${currentUser._id}`);
                    const userPosts = await postsRes.json();
                    renderProfile(currentUser, userPosts);
                    showView('profile');
                } catch (error) { alert(error.message); }
            }
            else if (loginForm) {
                e.preventDefault();
                const username = document.getElementById('loginUsername').value;
                const password = document.getElementById('loginPassword').value;
                try {
                    const response = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'Login failed');
                    localStorage.setItem('token', data.token);
                    initializeApp();
                } catch (error) { alert(`Login failed: ${error.message}`); }
            }
            else if (signupForm) {
                e.preventDefault();
                if (document.getElementById('signupButton').disabled) return;
                const email = document.getElementById('signupEmail').value;
                const fullName = document.getElementById('signupFullName').value;
                const username = document.getElementById('signupUsername').value;
                const password = document.getElementById('signupPassword').value;
                try {
                    const response = await fetch(`${API_URL}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, fullName, username, password }) });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'Signup failed');
                    alert('Signup successful! Please log in.');
                    signupView.classList.add('hidden');
                    loginView.classList.remove('hidden');
                } catch (error) { alert(`Signup failed: ${error.message}`); }
            }
            else if (messageForm) {
                e.preventDefault();
                const messageInput = document.getElementById('message-input');
                const message = messageInput.value;
                const receiverId = document.getElementById('message-window').dataset.userId;
                if (message && receiverId) {
                    socket.emit('sendMessage', { senderId: currentUser._id, receiverId, message });
                    const messageEl = document.createElement('div');
                    messageEl.textContent = message;
                    messageEl.className = "p-2 rounded-lg bg-blue-500 text-white self-end max-w-xs mb-2";
                    document.getElementById('messages-container').prepend(messageEl);
                    messageInput.value = '';
                }
            }
        } catch (error) {
            console.error("An error occurred in a form submit handler:", error);
        }
    });

    document.getElementById('showSignup').addEventListener('click', (e) => { e.preventDefault(); loginView.classList.add('hidden'); signupView.classList.remove('hidden'); });
    document.getElementById('showLogin').addEventListener('click', (e) => { e.preventDefault(); signupView.classList.add('hidden'); loginView.classList.remove('hidden'); });
    document.getElementById('logout-button').addEventListener('click', (e) => { e.preventDefault(); currentUser = null; localStorage.removeItem('token'); showView('auth'); });
    document.getElementById('dropdown-profile-link').addEventListener('click', (e) => { e.preventDefault(); if (currentUser) { document.getElementById('sidebar-profile-link').click(); } });
    document.getElementById('nav-home').addEventListener('click', (e) => { e.preventDefault(); initializeApp(); });
    document.getElementById('logo-home-link').addEventListener('click', (e) => { e.preventDefault(); initializeApp(); });
    document.getElementById('nav-profile-trigger').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('profile-dropdown').classList.toggle('hidden'); });
    document.getElementById('nav-create-post').addEventListener('click', (e) => { e.preventDefault(); createPostModal.classList.replace('hidden', 'flex'); });
    document.getElementById('nav-chat').addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const res = await fetchWithAuth(`${API_URL}/api/users`);
            usersCache = await res.json();
            renderConversations(usersCache);
            showView('chat');
        } catch (error) {
            console.error("Could not fetch users for chat:", error);
        }
    });

    userSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length > 0) {
            const filteredUsers = usersCache.filter(user =>
                user.username.toLowerCase().includes(query) || user.fullName.toLowerCase().includes(query)
            );
            renderUserSearchResults(filteredUsers);
        } else {
            userSearchResults.innerHTML = '';
            userSearchResults.classList.add('hidden');
        }
    });

    document.body.addEventListener('click', (e) => {
        if (!e.target.closest('#user-search-input') && !e.target.closest('#user-search-results')) {
            userSearchResults.classList.add('hidden');
        }
    });

    const resetCommentModal = (modalForm, modalInput) => {
        if (modalInput) modalInput.value = '';
        if (modalInput) modalInput.placeholder = 'Add a comment...';
        if (modalForm) delete modalForm.dataset.parentId;
    };

    document.addEventListener('click', (e) => {
        if (e.target.closest('.modal-cancel-button') || e.target.classList.contains('modal-backdrop')) {
            createPostModal.classList.replace('flex', 'hidden');
            shareModal.classList.replace('flex', 'hidden');
            editProfileModal.classList.replace('flex', 'hidden');
            editPostModal.classList.replace('flex', 'hidden');
        }
        if (e.target.closest('.feed-modal-close-button') || e.target.classList.contains('modal-backdrop')) {
            feedSinglePostModal.classList.replace('flex', 'hidden');
        }
        if (e.target.closest('.profile-modal-close-button') || e.target.classList.contains('modal-backdrop')) {
            profileSinglePostModal.classList.replace('flex', 'hidden');
        }
        if (e.target.closest('.feed-comment-modal-cancel-button') || e.target.classList.contains('modal-backdrop')) {
            feedCommentModal.classList.replace('flex', 'hidden');
            resetCommentModal(document.getElementById('feed-modal-comment-form'), document.getElementById('feed-modal-comment-input'));
        }
        if (e.target.closest('.profile-comment-modal-cancel-button') || e.target.classList.contains('modal-backdrop')) {
            profileCommentModal.classList.replace('flex', 'hidden');
            resetCommentModal(document.getElementById('profile-modal-comment-form'), document.getElementById('profile-modal-comment-input'));
        }

        const profileDropdown = document.getElementById('profile-dropdown');
        const profileTrigger = document.getElementById('nav-profile-trigger');
        if (profileTrigger && !profileTrigger.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.add('hidden');
        }
    });

    // Delegated listener for all emoji-click events
    document.body.addEventListener('emoji-click', e => {
        const picker = e.target;
        const unicode = e.detail.unicode;

        if (picker.closest('#edit-profile-modal')) {
            document.getElementById('editBio').value += unicode;
            picker.classList.add('hidden');
        } else if (picker.closest('#feed-comment-modal')) {
            document.getElementById('feed-modal-comment-input').value += unicode;
            picker.classList.add('hidden');
        } else if (picker.closest('#profile-comment-modal')) {
            document.getElementById('profile-modal-comment-input').value += unicode;
            picker.classList.add('hidden');
        } else if (picker.closest('#feed-single-post-modal')) {
            const input = picker.previousElementSibling.querySelector('.feed-comment-input');
            if (input) input.value += unicode;
            picker.classList.add('hidden');
        } else if (picker.closest('#profile-single-post-modal')) {
            const input = picker.previousElementSibling.querySelector('.profile-comment-input');
            if (input) input.value += unicode;
            picker.classList.add('hidden');
        } else if (picker.closest('#create-post-modal')) {
            document.getElementById('postCaption').value += unicode;
            picker.classList.add('hidden');
        }
    });

    const loginUsernameInput = document.getElementById('loginUsername');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginButton = document.getElementById('loginButton');
    function checkLoginInputs() { const isFilled = loginUsernameInput.value.trim() !== '' && loginPasswordInput.value.trim() !== ''; loginButton.disabled = !isFilled; loginButton.classList.toggle('enabled', isFilled); }
    loginUsernameInput.addEventListener('input', checkLoginInputs);
    loginPasswordInput.addEventListener('input', checkLoginInputs);

    const signupEmailInput = document.getElementById('signupEmail');
    const signupFullNameInput = document.getElementById('signupFullName');
    const signupUsernameInput = document.getElementById('signupUsername');
    const signupPasswordInput = document.getElementById('signupPassword');
    const signupButton = document.getElementById('signupButton');
    function checkSignupInputs() { const isFilled = signupEmailInput.value.trim() !== '' && signupFullNameInput.value.trim() !== '' && signupUsernameInput.value.trim() !== '' && signupPasswordInput.value.trim() !== ''; signupButton.disabled = !isFilled; signupButton.classList.toggle('enabled', isFilled); }
    [signupEmailInput, signupFullNameInput, signupUsernameInput, signupPasswordInput].forEach(el => el.addEventListener('input', checkSignupInputs));

    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIconMoon = document.getElementById('theme-icon-moon');
    const themeIconSun = document.getElementById('theme-icon-sun');
    function applyTheme(theme) { if (theme === 'dark') { document.documentElement.classList.add('dark'); themeIconMoon.classList.add('hidden'); themeIconSun.classList.remove('hidden'); } else { document.documentElement.classList.remove('dark'); themeIconSun.classList.add('hidden'); themeIconMoon.classList.remove('hidden'); } }
    const savedTheme = localStorage.getItem('color-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);
    themeToggleBtn.addEventListener('click', function () { const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark'; localStorage.setItem('color-theme', newTheme); applyTheme(newTheme); });

    initializeApp();
});