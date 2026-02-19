const appState = {
    user: null,
    artworks: []
};

// --- Utilities ---
// --- Utilities ---
function toggleElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn('Element not found:', id);
        if (typeof showToast === 'function') showToast('Element not found: ' + id, 'error');
        return;
    }
    const isHidden = window.getComputedStyle(el).display === 'none';
    el.style.display = isHidden ? 'block' : 'none';

    // Debug toast
    console.log('Toggled', id, 'to', el.style.display);
}
window.toggleElement = toggleElement;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    loadSettings();
    loadFeatured();
    loadGallery();
    initScrollReveal();
});

function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.1 });

    // We'll call this after items are rendered too
    window.refreshReveal = () => {
        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    };
}

async function loadSettings() {
    try {
        const res = await fetch('api/artworks.php?action=settings');
        const data = await res.json();
        if (data.success) {
            const s = data.settings;
            if (s.gallery_name) {
                document.title = s.gallery_name;
                document.querySelector('.logo').textContent = s.gallery_name;
            }
            if (s.hero_title) document.querySelector('.hero h1').textContent = s.hero_title;
            if (s.hero_subtitle) document.querySelector('.hero p').textContent = s.hero_subtitle;
        }
    } catch (e) { console.error('Settings load failed', e); }
}

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

        if (appState.user.role === 'artist' || appState.user.role === 'admin') {
            const dashboardLink = document.getElementById('dashboard-link');
            dashboardLink.style.display = 'inline-block';
            dashboardLink.textContent = appState.user.role === 'admin' ? 'ArtSpace HUD' : 'Artist Dashboard';

            // For admin, change the click behavior to go to admin folder
            if (appState.user.role === 'admin') {
                dashboardLink.onclick = () => window.location.href = 'admin/index.html';
            } else {
                dashboardLink.onclick = () => showSection('dashboard-section');
            }
        } else {
            document.getElementById('dashboard-link').style.display = 'none';
        }
    } else {
        authLinks.style.display = 'inline-block';
        userLinks.style.display = 'none';
    }
}

// --- Navigation ---
function showSection(id, extra = null) {
    document.querySelectorAll('main > section').forEach(sec => sec.style.display = 'none');
    const target = document.getElementById(id);
    if (target) target.style.display = 'block';

    // Refresh data if needed
    if (id === 'dashboard-section' || id === 'dashboard-profile-section') loadArtistDashboard();
    if (id === 'gallery-section') loadGallery();
    if (id === 'artist-profile-section' && extra) loadArtistProfile(extra);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function previewProfileImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('edit-profile-preview').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
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
            if (appState.user.role === 'admin') {
                window.location.href = 'admin.php';
                return;
            }
            updateAuthUI();
            showSection('gallery-section');
            showToast('Authorization successful!');
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

async function loadFeatured() {
    try {
        const res = await fetch('api/artworks.php?action=featured_list');
        const data = await res.json();
        if (data.success && data.artworks.length > 0) {
            document.getElementById('featured-section').style.display = 'block';
            renderFeatured(data.artworks);
        } else {
            document.getElementById('featured-section').style.display = 'none';
        }
    } catch (e) {
        console.error('Failed to load featured arts', e);
    }
}

function renderFeatured(list) {
    const grid = document.getElementById('featured-grid');
    grid.innerHTML = list.map(art => `
        <div class="art-card featured-card reveal" onclick="openModal(${art.id})">
            <div class="featured-badge">FEATURED</div>
            <img src="${art.image_path}" alt="${art.title}" onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
            <div class="info">
                <h3>${art.title}</h3>
                <p>by <span class="artist-link" onclick="event.stopPropagation(); showSection('artist-profile-section', ${art.artist_id})">${art.artist_name}</span> ${art.is_verified ? '<span class="verified-check" title="Verified Artist">☑</span>' : ''}</p>
                <div class="price">$${parseFloat(art.price).toFixed(2)}</div>
            </div>
        </div>
    `).join('');
    if (window.refreshReveal) window.refreshReveal();
}

function renderGallery(list) {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = list.map(art => `
        <div class="art-card reveal" onclick="openModal(${art.id})">
            <img src="${art.image_path}" alt="${art.title}" onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
            ${art.status === 'sold' ? '<span class="sold-badge">SOLD</span>' : ''}
            <div class="info">
                <h3>${art.title}</h3>
                <p>by <span class="artist-link" onclick="event.stopPropagation(); showSection('artist-profile-section', ${art.artist_id})">${art.artist_name}</span> ${art.is_verified ? '<span class="verified-check" title="Verified Artist">☑</span>' : ''}</p>
                <div class="price">$${parseFloat(art.price).toFixed(2)}</div>
            </div>
        </div>
    `).join('');
    if (window.refreshReveal) window.refreshReveal();
}

function filterGallery() {
    const q = document.getElementById('search-bar').value.toLowerCase();
    const filtered = appState.artworks.filter(art =>
        art.title.toLowerCase().includes(q) ||
        art.artist_name.toLowerCase().includes(q)
    );
    renderGallery(filtered);
}

// --- Artist Dashboard ---
async function loadArtistDashboard() {
    if (!appState.user || appState.user.role !== 'artist') return;

    // Load Profile Settings data
    loadProfileSettings();

    // Reuse gallery loading but filter safely in frontend (or create specific API)
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
                    <p>Status: ${art.status.toUpperCase()}</p>
                 </div>
            </div>
        `).join('');
    }
}

async function loadProfileSettings() {
    try {
        const res = await fetch(`user_profile_api.php?action=fetch_profile&t=${Date.now()}`);
        if (!res.ok) throw new Error('Failed to fetch profile info');

        const data = await res.json();
        if (data.success && data.profile) {
            const bioField = document.getElementById('edit-profile-bio');
            if (bioField) {
                bioField.value = data.profile.bio || '';
            }
            const previewImg = document.getElementById('edit-profile-preview');
            if (previewImg) {
                previewImg.src = data.profile.profile_image || 'https://via.placeholder.com/150?text=Artist';
            }
        }
    } catch (e) {
        console.error('Failed to load profile details', e);
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('bio', document.getElementById('edit-profile-bio').value);

    const imgFile = document.getElementById('edit-profile-img').files[0];
    if (imgFile) {
        formData.append('profile_image', imgFile);
    }

    try {
        const res = await fetch(`user_profile_api.php?action=update_profile&t=${Date.now()}`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            showToast('Profile updated successfully!');
            showSection('dashboard-section');
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        showToast('Update failed', 'error');
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

    // Make artist name clickable in modal too
    const artistNameEl = document.getElementById('modal-artist');
    artistNameEl.textContent = details.artist_name;
    artistNameEl.style.cursor = 'pointer';
    artistNameEl.onclick = () => {
        closeModal();
        showSection('artist-profile-section', details.artist_id);
    };

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

// --- Public Artist Profile ---
async function loadArtistProfile(artistId) {
    try {
        const res = await fetch(`api/artists.php?action=profile&id=${artistId}`);
        const data = await res.json();

        if (data.success) {
            const artist = data.artist;
            const artworks = data.artworks;

            // Fill details
            document.getElementById('profile-name').textContent = artist.name;
            document.getElementById('profile-bio').textContent = artist.bio || 'This artist has not provided a biography yet.';
            document.getElementById('profile-joined').textContent = new Date(artist.created_at).toLocaleDateString();
            document.getElementById('profile-art-count').textContent = artworks.length;

            const avatarEl = document.getElementById('profile-avatar');
            avatarEl.src = artist.profile_image || 'https://via.placeholder.com/150?text=Artist';
            avatarEl.onerror = () => { avatarEl.src = 'https://via.placeholder.com/150?text=Artist'; };

            // Show/hide verified badge
            document.getElementById('profile-verified').style.display = artist.is_verified ? 'inline-block' : 'none';

            // Render their works
            renderProfileGallery(artworks);
        } else {
            showToast(data.error, 'error');
            showSection('gallery-section');
        }
    } catch (e) {
        showToast('Error loading profile', 'error');
        showSection('gallery-section');
    }
}

function renderProfileGallery(list) {
    const grid = document.getElementById('profile-gallery-grid');
    if (list.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">This artist has no public exhibition yet.</p>';
    } else {
        grid.innerHTML = list.map(art => `
            <div class="art-card reveal" onclick="openModal(${art.id})">
                <img src="${art.image_path}" alt="${art.title}" onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
                <div class="info">
                    <h3>${art.title}</h3>
                    <div class="price">$${parseFloat(art.price).toFixed(2)}</div>
                </div>
            </div>
        `).join('');
    }
    if (window.refreshReveal) window.refreshReveal();
}

// --- Auth UI Helpers ---
function updateLoginVisual() {
    const role = document.getElementById('login-role').value;
    const visualSide = document.getElementById('login-visual-side');
    const title = document.getElementById('login-visual-title');
    const text = document.getElementById('login-visual-text');

    if (role === 'artist') {
        visualSide.className = 'auth-visual-side bg-artist';
        title.innerText = "Login to unlock your creative potential.";
        text.innerText = "Access your personal portfolio and showcase your work to the world.";
    } else {
        visualSide.className = 'auth-visual-side bg-collector';
        title.innerText = "Discover masterpieces that speak.";
        text.innerText = "Explore curated fine art and acquire unique pieces for your personal collection.";
    }
}

function updateRegisterVisual() {
    const role = document.getElementById('reg-role').value;
    const visualSide = document.getElementById('reg-visual-side');
    const title = document.getElementById('reg-visual-title');
    const text = document.getElementById('reg-visual-text');

    if (role === 'artist') {
        visualSide.className = 'auth-visual-side bg-artist';
        title.innerText = "Unlock your creative potential.";
        text.innerText = "Join our community of elite creators and showcase your vision to refined patrons.";
    } else {
        visualSide.className = 'auth-visual-side bg-collector';
        title.innerText = "Discover masterpieces that speak.";
        text.innerText = "Start your journey as an art patron and discover unique, verified masterpieces.";
    }
}

// Close modal on outside click
window.onclick = function (event) {
    const modal = document.getElementById('artwork-modal');
    if (event.target == modal) {
        closeModal();
    }
}

