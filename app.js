const appState = {
    user: null,
    artworks: []
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    loadGallery();
});

async function checkSession() {
    try {
        const res = await fetch('api/auth.php?action=check');
        const data = await res.json();
        if (data.logged_in) {
            appState.user = data.user;
            updateAuthUI();
        }
    } catch (e) {
        console.error('Session check failed', e);
    }
}

function updateAuthUI() {
    const authLinks = document.getElementById('auth-links');
    const userLinks = document.getElementById('user-links');
    const userName = document.getElementById('user-name-display');

    if (appState.user) {
        authLinks.style.display = 'none';
        userLinks.style.display = 'inline-block';
        userName.textContent = `Hello, ${appState.user.name}`;

        if (appState.user.role === 'artist') {
            document.getElementById('dashboard-link').style.display = 'inline-block';
        } else {
            document.getElementById('dashboard-link').style.display = 'none';
        }
    } else {
        authLinks.style.display = 'inline-block';
        userLinks.style.display = 'none';
    }
}

// --- Navigation ---
function showSection(id) {
    document.querySelectorAll('main > section').forEach(sec => sec.style.display = 'none');
    document.getElementById(id).style.display = 'block';

    // Refresh data if needed
    if (id === 'dashboard-section') loadArtistDashboard();
    if (id === 'gallery-section') loadGallery();
}

// --- Authentication ---
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch('api/auth.php?action=login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success) {
            appState.user = data.user;
            updateAuthUI();
            showSection('gallery-section');
            showToast('Login successful!');
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    const bio = document.getElementById('reg-bio').value;

    try {
        const res = await fetch('api/auth.php?action=register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, role, bio })
        });
        const data = await res.json();

        if (data.success) {
            showToast('Registration successful! Please login.');
            showSection('login-section');
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}

async function logout() {
    await fetch('api/auth.php?action=logout', { method: 'POST' });
    appState.user = null;
    updateAuthUI();
    showSection('gallery-section');
    showToast('Logged out');
}

// --- Gallery & Artworks ---
async function loadGallery() {
    const res = await fetch('api/artworks.php?action=list');
    const data = await res.json();
    if (data.success) {
        appState.artworks = data.artworks;
        renderGallery(data.artworks);
    }
}

function renderGallery(list) {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = list.map(art => `
        <div class="art-card" onclick="openModal(${art.id})">
            <img src="${art.image_path}" alt="${art.title}" onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
            ${art.status === 'sold' ? '<span class="sold-badge">SOLD</span>' : ''}
            <div class="info">
                <h3>${art.title}</h3>
                <p>by ${art.artist_name}</p>
                <div class="price">$${parseFloat(art.price).toFixed(2)}</div>
            </div>
        </div>
    `).join('');
}

function filterGallery() {
    const query = document.getElementById('search-bar').value.toLowerCase();
    const filtered = appState.artworks.filter(art =>
        art.title.toLowerCase().includes(query) ||
        art.artist_name.toLowerCase().includes(query)
    );
    renderGallery(filtered);
}

// --- Artist Dashboard ---
async function loadArtistDashboard() {
    if (!appState.user || appState.user.role !== 'artist') return;

    // Reuse gallery loading but filter safely in frontend (or create specific API)
    // For simplicity, we just filter the loaded artworks if we have them, or fetch list
    await loadGallery();
    const myArt = appState.artworks.filter(a => a.artist_id == appState.user.id);

    const dashboardGrid = document.getElementById('artist-artworks');
    if (myArt.length === 0) {
        dashboardGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No artworks uploaded yet.</p>';
    } else {
        dashboardGrid.innerHTML = myArt.map(art => `
            <div class="art-card">
                 <img src="${art.image_path}" alt="${art.title}">
                 <div class="info">
                    <h3>${art.title}</h3>
                    <p class="price">$${art.price}</p>
                    <p>Status: ${art.status}</p>
                 </div>
            </div>
        `).join('');
    }
}

async function handleAddArtwork(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', document.getElementById('art-title').value);
    formData.append('description', document.getElementById('art-desc').value);
    formData.append('price', document.getElementById('art-price').value);
    formData.append('image', document.getElementById('art-image').files[0]);

    try {
        const res = await fetch('api/artworks.php?action=add', {
            method: 'POST',
            body: formData // Fetch handles Content-Type for FormData automatically
        });
        const data = await res.json();

        if (data.success) {
            showToast('Artwork uploaded!');
            e.target.reset();
            showSection('dashboard-section');
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        showToast('Upload failed', 'error');
    }
}

// --- Modal & Details ---
async function openModal(id) {
    const modal = document.getElementById('artwork-modal');
    // Basic pre-fill from cached data
    const art = appState.artworks.find(a => a.id == id);
    if (!art) return;

    // Fetch full details
    const res = await fetch(`api/artworks.php?action=details&id=${id}`);
    const data = await res.json();
    if (!data.success) return;

    const details = data.artwork;
    appState.currentArtworkId = id;

    document.getElementById('modal-img').src = details.image_path;
    document.getElementById('modal-title').textContent = details.title;
    document.getElementById('modal-artist').textContent = details.artist_name;
    document.getElementById('modal-price').textContent = `$${parseFloat(details.price).toFixed(2)}`;
    document.getElementById('modal-desc').textContent = details.description;

    // Status Logic
    const statusEl = document.getElementById('modal-status');
    const buyBtn = document.getElementById('buy-btn');

    statusEl.textContent = details.status.toUpperCase();
    if (details.status === 'sold') {
        statusEl.style.color = 'var(--danger)';
        buyBtn.style.display = 'none';
    } else {
        statusEl.style.color = 'var(--success)';
        // Only clients can buy
        if (appState.user && appState.user.role === 'client') {
            buyBtn.style.display = 'block';
        } else {
            buyBtn.style.display = 'none';
        }
    }

    // Rating
    document.getElementById('modal-rating').textContent = details.avg_rating || 'N/A';

    // Reviews
    loadReviews(id);

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('artwork-modal').style.display = 'none';
    appState.currentArtworkId = null;
}

// --- Purchasing ---
async function purchaseArtwork() {
    if (!confirm('Confirm purchase?')) return;

    try {
        const res = await fetch('api/artworks.php?action=purchase', {
            method: 'POST',
            body: JSON.stringify({ artwork_id: appState.currentArtworkId })
        });
        const data = await res.json();

        if (data.success) {
            showToast('Purchase successful!');
            closeModal();
            loadGallery(); // Refresh to show SOLD status
        } else {
            showToast(data.error, 'error');
        }
    } catch (e) {
        showToast('Error processing purchase', 'error');
    }
}

// --- Reviews ---
async function loadReviews(artworkId) {
    const list = document.getElementById('review-list');
    list.innerHTML = 'Loading...';

    const res = await fetch(`api/reviews.php?action=list&artwork_id=${artworkId}`);
    const data = await res.json();

    if (data.success && data.reviews.length > 0) {
        list.innerHTML = data.reviews.map(r => `
            <div class="review-item">
                <strong>${r.user_name}</strong> - <span style="color: gold">${'★'.repeat(r.rating)}</span>
                <p>${r.comment}</p>
            </div>
        `).join('');
    } else {
        list.innerHTML = '<p>No reviews yet.</p>';
    }

    // Show review form only if client
    const form = document.getElementById('review-form');
    if (appState.user && appState.user.role === 'client') {
        form.style.display = 'block';
    } else {
        form.style.display = 'none';
    }
}

async function submitReview(e) {
    e.preventDefault();

    // Get rating from star radio buttons
    const ratingInput = document.querySelector('input[name="rating"]:checked');
    if (!ratingInput) {
        showToast('Please select a rating', 'error');
        return;
    }
    const rating = ratingInput.value;
    const comment = document.getElementById('review-comment').value;

    try {
        const res = await fetch('api/reviews.php?action=add', {
            method: 'POST',
            body: JSON.stringify({
                artwork_id: appState.currentArtworkId,
                rating,
                comment
            })
        });
        const data = await res.json();

        if (data.success) {
            showToast('Review submitted!');
            e.target.reset();
            loadReviews(appState.currentArtworkId);
            // Refresh details to update avg rating
            // (We could re-fetch details, but for now just reviews is fine)
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        showToast('Review failed', 'error');
    }
}

// --- Toast ---
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.backgroundColor = type === 'error' ? 'var(--danger)' : 'var(--success)';
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Close modal on outside click
window.onclick = function (event) {
    const modal = document.getElementById('artwork-modal');
    if (event.target == modal) {
        closeModal();
    }
}
