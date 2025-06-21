// === KOD ZA ZABRANU ZUMIRANJA ===
document.addEventListener('touchstart', function(event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchmove', function(event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}, { passive: false });
// ===================================


// --- GLOBALNE VARIJABLE ---
let trenutniKorisnik = null;
let sviKorisnici = [];
let svePijanke = [];
let privatnePoruke = {};
let trenutniChatPartnerId = null;
let mojPoz = null;
let activityInterval = null;
let chatStatusInterval = null;
let globalDataRefreshInterval = null;
let odabranaSlika = null;
let odabranaEditSlika = null;
// Nova navigacijska logika
let navigationStack = [];

// === GLOBALNE VARIJABLE ZA SUSTAV PRATITELJA ===
let myFollowings = []; // Niz ID-jeva korisnika koje ja pratim
let profileFollowers = []; // Niz ID-jeva pratitelja za prikazani profil
let profileFollowing = []; // Niz ID-jeva onih koje prikazani profil prati
// ======================================================

// --- NAVIGACIJSKE FUNKCIJE ---
function swap(hideId, showId) {
    const hideElement = document.getElementById(hideId);
    const showElement = document.getElementById(showId);
    if (!showElement) return;

    const showNewElement = () => {
        showElement.style.display = 'flex';
        setTimeout(() => {
            showElement.classList.add('active-screen');
        }, 10);
    };

    if (hideElement && hideElement.classList.contains('active-screen')) {
        hideElement.classList.remove('active-screen');
        hideElement.classList.add('fade-out-screen');
        hideElement.addEventListener('animationend', function handler() {
            hideElement.style.display = 'none';
            hideElement.classList.remove('fade-out-screen');
            hideElement.removeEventListener('animationend', handler);
            showNewElement();
        }, { once: true });
    } else {
        if (hideElement) {
            hideElement.style.display = 'none';
            hideElement.classList.remove('active-screen', 'fade-out-screen');
        }
        showNewElement();
    }
}

function navigateTo(targetScreenId) {
    const currentScreenEl = document.querySelector('.container.active-screen');
    if (currentScreenEl) {
        navigationStack.push(currentScreenEl.id);
        swap(currentScreenEl.id, targetScreenId);
    } else {
        swap(null, targetScreenId);
    }
}

function navigateBack() {
    const lastScreenId = navigationStack.pop();
    if (lastScreenId) {
        const currentScreenEl = document.querySelector('.container.active-screen');
        if (currentScreenEl && currentScreenEl.id === 'privatniChat') {
            if (chatStatusInterval) clearInterval(chatStatusInterval);
            trenutniChatPartnerId = null;
            const privatniInput = document.getElementById("privatniInput");
            privatniInput.value = "";
            privatniInput.style.height = 'auto';
            document.getElementById('posaljiPrivatnoBtn').classList.remove('enabled');
            toggleAppUI(true); // Prikazi nav bar kada se vratis iz chata
        }
        // === NOVO: Resetiraj podatke o pratiteljima/praćenju kada se vraćaš iz profila ===
        if (currentScreenEl && (currentScreenEl.id === 'glavniDio' || currentScreenEl.id === 'editProfil')) {
            profileFollowers = [];
            profileFollowing = [];
        }
        // =================================================================================

        swap(currentScreenEl.id, lastScreenId);
        azurirajNotifikacije();
    } else {
        console.error("Navigation stack empty, can't go back.");
    }
}


// --- POSTOJEĆE FUNKCIJE (S PRILAGODBAMA) ---

async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    if (token) {
        options.headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
    }
    return fetch(url, options);
}

function compressImage(base64Image, maxWidth = 400, quality = 0.8) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Image;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width; let height = img.height;
            if (width > maxWidth) {
                height = height * (maxWidth / width);
                width = maxWidth;
            }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => { resolve(base64Image); };
    });
}

function proveriPrihvatanje() {
    const checkbox = document.getElementById('prihvatamPravila');
    const button = document.getElementById('nastaviBtn');
    if (button && checkbox) button.disabled = !checkbox.checked;
}

async function globalRefreshUI() {
    if (!trenutniKorisnik) return;
    // === NOVO: Dohvati podatke o praćenjima za trenutnog korisnika ===
    await Promise.all([ dohvatiSveKorisnike(), dohvatiSvePijanke(), dohvatiSvePoruke(), dohvatiMojaPracenja() ]);
    // ===============================================================

    if (document.getElementById("homePrikazPijanki")?.classList.contains('active-screen')) { prikaziPijankePregled(); }
    if (document.getElementById("inboxPrikaz")?.classList.contains('active-screen')) { otvoriInbox(); }
    if (document.getElementById("privatniChat")?.classList.contains('active-screen') && trenutniChatPartnerId) { prikaziPrivatniLog(); }

    // === NOVO: Ako je profil otvoren, ažuriraj ga (radi brojača) ===
    if (document.getElementById("glavniDio")?.classList.contains('active-screen') && document.getElementById('profilKorisnika')?.style.display !== 'none') {
        const currentProfileId = document.getElementById('profilKorisnika')?.dataset?.userId;
        if (currentProfileId) {
            otvoriProfil(currentProfileId, true); // True da ne dodaje na navigation stack
        }
    }
    // ===============================================================
    azurirajNotifikacije();
}

document.addEventListener('DOMContentLoaded', () => {
    const slikaUploadEl = document.getElementById("slikaUpload");
    if (slikaUploadEl) {
        slikaUploadEl.addEventListener("change", function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = e => {
                    odabranaSlika = e.target.result;
                    const previewElement = document.getElementById("previewSlikes");
                    if (previewElement) {
                        previewElement.src = odabranaSlika;
                        previewElement.style.display = "block";
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    const hiddenEditSlikaUploadEl = document.getElementById("hiddenEditSlikaUpload");
    if (hiddenEditSlikaUploadEl) {
        hiddenEditSlikaUploadEl.addEventListener("change", function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = e => {
                    odabranaEditSlika = e.target.result;
                    const previewElement = document.getElementById("previewEditSlike");
                    if (previewElement) {
                        previewElement.src = odabranaEditSlika;
                        if (previewElement.style.display === "none") {
                            previewElement.style.display = "block";
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

async function registruj() {
    const ime = document.getElementById("ime").value.trim();
    const sifra = document.getElementById("sifra").value.trim();
    const instagram = document.getElementById("instagram").value.trim();
    const tiktok = document.getElementById("tiktok").value.trim();
    const opis = document.getElementById("opis").value.trim();
    const registrujBtn = document.getElementById('registracijaSubmitBtn');

    if (!ime || !sifra || !odabranaSlika) { return alert("Molimo popunite korisničko ime, lozinku i odaberite sliku!"); }

    registrujBtn.disabled = true; registrujBtn.textContent = 'Registracija u tijeku...';

    try {
        const compressedSlika = await compressImage(odabranaSlika);
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: ime, password: sifra, slika: compressedSlika, instagram, tiktok, opis })
        });
        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            await ulogujSe(ime, sifra);
        } else {
            alert("Greška pri registraciji: " + data.message);
        }
    } catch (error) {
        alert("Došlo je do greške pri registraciji.");
    } finally {
        registrujBtn.disabled = false; registrujBtn.textContent = 'Spremi';
    }
}

async function ulogujSe(usernameFromRegister = null, passwordFromRegister = null) {
    const ime = usernameFromRegister || document.getElementById("loginIme").value.trim();
    const sifra = passwordFromRegister || document.getElementById("loginSifra").value.trim();
    const loginBtn = document.getElementById('loginSubmitBtn');

    if (!ime || !sifra) { return alert("Unesite korisničko ime i lozinku!"); }

    loginBtn.disabled = true; loginBtn.textContent = 'Prijava u tijeku...';

    try {
        const response = await authenticatedFetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: ime, password: sifra })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem("token", data.token);
            trenutniKorisnik = data.user;
            // === NOVO: Dohvati inicijalne podatke o praćenjima nakon prijave ===
            await Promise.all([dohvatiSveKorisnike(), dohvatiSvePijanke(), dohvatiSvePoruke(), dohvatiMojaPracenja()]);
            // =================================================================
            pokreniAplikaciju();
        } else {
            alert("Greška pri prijavi: " + data.message);
        }
    } catch (error) {
        alert("Došlo je do greške pri prijavi.");
    } finally {
        loginBtn.disabled = false; loginBtn.textContent = 'Prijavi se';
    }
}

async function odjaviSe() {
    [activityInterval, chatStatusInterval, globalDataRefreshInterval].forEach(i => i && clearInterval(i));
    if (trenutniKorisnik && trenutniKorisnik.id) { await azurirajMojuAktivnost(true); }
    localStorage.removeItem("token");
    trenutniKorisnik = null; odabranaSlika = null; odabranaEditSlika = null;
    myFollowings = []; // NOVO: Resetiraj moja praćenja
    profileFollowers = []; // NOVO: Resetiraj podatke o profilu
    profileFollowing = []; // NOVO: Resetiraj podatke o profilu

    ["loginIme", "loginSifra", "ime", "sifra", "instagram", "tiktok", "opis", "editIme", "editOpis", "editInstagram", "editTiktok", "opisPijanke", "privatniInput"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = "";
    });
    navigationStack = [];
    swap(document.querySelector('.container.active-screen').id, 'intro');
}

function pokreniAplikaciju() {
    navigationStack = [];
    swap(document.querySelector('.container.active-screen')?.id || null, 'homePrikazPijanki');
    ocistiPijankePregled();

    [activityInterval, globalDataRefreshInterval].forEach(i => i && clearInterval(i));
    activityInterval = setInterval(azurirajMojuAktivnost, 15e3);
    globalDataRefreshInterval = setInterval(globalRefreshUI, 30e3);

    azurirajMojuAktivnost();
    dohvatiLokaciju(() => {
        prikaziPijankePregled();
        azurirajNotifikacije();
    });
}


function prikaziMojProfil() {
    if (trenutniKorisnik && trenutniKorisnik.id) {
        otvoriProfil(trenutniKorisnik.id);
    } else {
        navigateTo('odabir');
    }
}

async function prikaziEditProfila() {
    if (!trenutniKorisnik || !trenutniKorisnik.id) return;
    const user = sviKorisnici.find(u => u.id === trenutniKorisnik.id);
    if (!user) return;
    document.getElementById("editIme").value = user.ime || '';
    document.getElementById("editOpis").value = user.opis || '';
    document.getElementById("editInstagram").value = user.instagram || '';
    document.getElementById("editTiktok").value = user.tiktok || '';
    document.getElementById("previewEditSlikes").src = user.slika || 'default_profile.png';
    document.getElementById("previewEditSlikes").style.display = "block";

    odabranaEditSlika = null;

    const confirmButton = document.getElementById('sacuvajProfilBtn');
    if (confirmButton) {
        confirmButton.classList.remove('hidden');
        confirmButton.classList.remove('loading');
    }

    navigateTo('editProfil');
}

async function sacuvajProfil() {
    if (!trenutniKorisnik || !trenutniKorisnik.id) {
        alert("Niste prijavljeni.");
        return;
    }

    const novoIme = document.getElementById("editIme").value.trim();
    const noviOpis = document.getElementById("editOpis").value.trim();
    const noviInstagram = document.getElementById("editInstagram").value.trim();
    const noviTiktok = document.getElementById("editTiktok").value.trim();
    const confirmButton = document.getElementById('sacuvajProfilBtn');

    if (!novoIme) return alert("Ime ne može biti prazno!");

    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.classList.add('loading');
    }

    let finalSlika = null;
    if (odabranaEditSlika) {
        finalSlika = await compressImage(odabranaEditSlika);
    } else {
        finalSlika = document.getElementById("previewEditSlikes").src;
    }

    const updateData = { username: novoIme, opis: noviOpis, instagram: noviInstagram, tiktok: noviTiktok };
    if (finalSlika) { updateData.slika = finalSlika; }

    try {
        const response = await authenticatedFetch(`/api/users/${trenutniKorisnik.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            await globalRefreshUI();
            prikaziMojProfil();
        } else {
            alert("Greška pri spremanju profila: " + data.message);
        }
    } catch (error) {
        alert("Došlo je do greške pri spremanja profila.");
    } finally {
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.classList.remove('loading');
        }
    }
}

async function azurirajMojuAktivnost(loggingOut = false) {
    if (!trenutniKorisnik || !trenutniKorisnik.id) return;
    try {
        await authenticatedFetch(`/api/users/${trenutniKorisnik.id}/activity`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loggingOut })
        });
    }
    catch (error) { console.error("Greška pri ažuriranju aktivnosti:", error); }
}

function formatirajStatus(isoTimestamp) {
    if (!isoTimestamp) return { text: "Offline", online: false };
    const diffSekunde = Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 1e3);
    if (diffSekunde < 30) return { text: "Online", online: true };
    if (diffSekunde < 60) return { text: `viđen/a prije minutu`, online: false };
    const diffMinute = Math.round(diffSekunde / 60);
    if (diffMinute < 60) return { text: `viđen/a prije ${diffMinute} min`, online: false };
    const diffSati = Math.round(diffMinute / 60);
    if (diffSati < 24) return { text: `viđen/a prije ${diffSati} h`, online: false };
    return { text: `viđen/a prije ${Math.round(diffSati / 24)} dana`, online: false };
}

function dohvatiLokaciju(callback) {
    if (!navigator.geolocation) return callback && callback();
    navigator.geolocation.getCurrentPosition(pos => {
        mojPoz = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        callback && callback();
    }, (error) => {
        alert("Pristup lokaciji je odbijen. Aplikacija ne može ispravno raditi bez lokacije.");
        callback && callback();
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}

function distKM(p1, p2) {
    if (!p1 || !p2) return "?";
    const R = 6371, dLat = (p2.lat - p1.lat) * Math.PI / 180, dLon = (p2.lon - p1.lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

function pokaziObjavu() {
    document.querySelector('#glavniNaslov').innerText = "Objavi pijanku";
    document.getElementById("objavaForma").style.display = "flex";
    document.getElementById("profilKorisnika").style.display = "none";
    document.getElementById("opisPijanke").value = "";
    document.querySelector('#glavniDio .back-button').style.display = 'none';

    const closeBtn = document.querySelector('#glavniDio .close-btn');
    closeBtn.style.display = 'flex';
    closeBtn.onclick = () => {
        navigateTo('homePrikazPijanki');
    };

    navigateTo('glavniDio');
}

async function objaviPijanku() {
    console.log("Objavi pijanku function called!");
    const opis = document.getElementById("opisPijanke").value.trim();
    if (!opis) {
        return alert("Molimo popunite opis pijanke!");
    }
    if (!mojPoz) {
        console.log("Location not available, attempting to fetch...");
        return dohvatiLokaciju(() => objaviPijanku());
    }

    const objaviBtn = document.querySelector('#objavaForma button');
    objaviBtn.disabled = true;
    objabiBtn.textContent = 'Objavljujem...';

    try {
        const response = await authenticatedFetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ opis, lat: mojPoz.lat, lon: mojPoz.lon })
        });
        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            await dohvatiSvePijanke();
            navigateTo('homePrikazPijanki');
            prikaziPijankePregled();
        } else {
            alert("Greška pri objavi pijanke: " + data.message);
        }
    } catch (error) {
        console.error("Error during objaviPijanku:", error);
        alert("Došlo je do greške pri objavi pijanke.");
    } finally {
        objabiBtn.disabled = false;
        objabiBtn.textContent = 'Objavi';
    }
}

async function obrisiPijanku(pijankaId, event) {
    if (event) event.stopPropagation();
    if (confirm("Jeste li sigurni da želite obrisati ovu objavu?")) {
        try {
            const response = await authenticatedFetch(`/api/posts?postId=${pijankaId}`, { method: 'DELETE' });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                await dohvatiSvePijanke();
                prikaziPijankePregled();
            } else {
                alert("Greška pri brisanju objave: " + data.message);
            }
        } catch (error) {
            alert("Došlo je do greške pri brisanja objave.");
        }
    }
}

function prikaziPijankePregled() {
    const div = document.getElementById("pijankePregled");
    if (!div) return;

    div.classList.remove('empty-message');

    if (svePijanke.length === 0) {
        div.innerHTML = '<p>Trenutno nitko ne pije. Budi prvi!</p>';
        div.classList.add('empty-message');
        return;
    }
    div.innerHTML = "";
    svePijanke.forEach(pijanka => {
        const autor = sviKorisnici.find(u => u.id === pijanka.korisnikId);
        if (!autor) return;
        const status = formatirajStatus(autor.lastActive);
        div.innerHTML += `
            <div class="pijanka" onclick="otvoriProfil('${autor.id}')">
                <div class="pijanka-header">
                    <img src="${autor.slika || 'default_profile.png'}" alt="Profilna slika" class="pijanka-profilna-slika">
                    <div class="pijanka-info">
                        <span class="status-dot ${status.online ? "online" : "offline"}"></span>
                        <div class="pijanka-info-text">
                            <strong>${autor.ime}</strong>
                            <p class="status-text">pije ${distKM(mojPoz, pijanka)}km od tebe</p>
                        </div>
                    </div>
                    ${trenutniKorisnik && autor.id === trenutniKorisnik.id ? `<button class="delete-btn" onclick="obrisiPijanku('${pijanka.id}', event)">🗑️</button>` : ""}
                </div>
                <div class="pijanka-opis">
                    <p>${pijanka.opis}</p>
                </div>
            </div>`;
    });
}

// === MODIFICIRANA FUNKCIJA otvoriProfil ===
async function otvoriProfil(korisnikId, fromRefresh = false) {
    if (!korisnikId) return;
    const korisnik = sviKorisnici.find(u => u.id === korisnikId);
    if (!korisnik) return;

    // Dohvati podatke o pratiteljima i praćenjima za prikazani profil
    await Promise.all([
        dohvatiPratiteljeKorisnika(korisnikId),
        dohvatiKogaKorisnikPrati(korisnikId)
    ]);

    const profilKorisnikaDiv = document.getElementById("profilKorisnika");
    profilKorisnikaDiv.dataset.userId = korisnikId;
    document.getElementById("objavaForma").style.display = "none";
    profilKorisnikaDiv.style.display = "flex";

    const backButton = document.querySelector('#glavniDio .back-button');
    const closeButton = document.querySelector('#profileCloseBtn');
    const headerTitle = document.querySelector('#glavniDio h2');

    backButton.style.display = 'none';

    let actionButtons = '';
    let isFollowing = myFollowings.includes(korisnikId);
    let followButtonHtml = '';

    if (trenutniKorisnik && korisnik.id === trenutniKorisnik.id) {
        closeButton.style.display = 'none';
        headerTitle.innerText = "Moj profil";
        actionButtons = `
            <button class="btn-primary" onclick="prikaziEditProfila()">Uredi profil</button>
            <button class="btn-danger btn-secondary" onclick="odjaviSe()">Odjavi se</button>
        `;
    } else {
        closeButton.style.display = 'flex';
        headerTitle.innerText = "Profil korisnika";
        followButtonHtml = `
            <button class="btn-${isFollowing ? 'secondary' : 'primary'}" onclick="toggleFollow('${korisnik.id}', ${isFollowing})">
                ${isFollowing ? 'Otprati' : 'Prati'}
            </button>
        `;
        actionButtons = `
            ${followButtonHtml}
            <button class="btn-secondary" onclick="pokreniPrivatniChat('${korisnik.id}')">💬 Pošalji poruku</button>
        `;
    }

    profilKorisnikaDiv.innerHTML = `
        <div class="profile-header">
            <img src="${korisnik.slika || 'default_profile.png'}" class="profilna-slika-velika">
            <h2>${korisnik.ime || 'Nepoznat korisnik'}</h2>
            <p class="status-text">${formatirajStatus(korisnik.lastActive).text}</p>
        </div>
        <div class="profile-stats">
            <div class="stat-item" onclick="showFollowers('${korisnik.id}', '${korisnik.ime}')">
                <strong>${profileFollowers.length}</strong>
                <span>Pratitelja</span>
            </div>
            <div class="stat-item" onclick="showFollowing('${korisnik.id}', '${korisnik.ime}')">
                <strong>${profileFollowing.length}</strong>
                <span>Pratim</span>
            </div>
        </div>
        <div class="profil-actions">${actionButtons}</div>
        <p class="profil-opis">${korisnik.opis || "Nema opisa."}</p>
        <div class="drustvene-mreze">${prikaziMreze(korisnik)}</div>

        <div class="profile-content-tabs">
            <button class="tab-button active" onclick="showProfileTab('tabPosts', this)">Objave</button>
        </div>
        <div id="tabPosts" class="tab-content active">
            ${await generateUserPostsHtml(korisnikId)}
        </div>
    `;

    if (!fromRefresh) {
        navigateTo('glavniDio');
    }
}
// ===================================


function prikaziMreze(p) {
    let s = "";
    if (p.instagram) s += `<a href="https://instagram.com/${p.instagram}" target="_blank"><img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" class="mreza-ikonica" alt="instagram"></a>`;
    if (p.tiktok) s += `<a href="https://www.tiktok.com/@${p.tiktok}" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/3046/3046122.png" class="mreza-ikonica" alt="tiktok"></a>`;
    return s || '<span style="font-size:13px; color:#888;">Nema društvenih mreža.</span>';
}

function azurirajNotifikacije() {
    let neprocitane = 0;
    const badgeGlavna = document.getElementById("notifikacijaPorukaGlavna");
    if (trenutniKorisnik && trenutniKorisnik.id) {
        for (const chatKey in privatnePoruke) {
            if (chatKey.includes(trenutniKorisnik.id)) {
                neprocitane += privatnePoruke[chatKey].filter(msg => !msg.isRead && msg.autorId !== trenutniKorisnik.id).length;
            }
        }
    }
    const brPrikaz = neprocitane > 9 ? '9+' : neprocitane;
    const prikazi = neprocitane > 0;
    if(badgeGlavna) {
        badgeGlavna.style.display = prikazi ? 'flex' : 'none';
        badgeGlavna.innerText = brPrikaz;
    }
}

function otvoriInbox() {
    const div = document.getElementById("listaChatova");
    div.innerHTML = "";

    const chatKeys = (trenutniKorisnik && trenutniKorisnik.id) ? Object.keys(privatnePoruke).filter(key => key.includes(trenutniKorisnik.id)) : [];

    if (chatKeys.length === 0) {
        div.innerHTML = '<p style="text-align:center;color:#888;">Nemaš još nijednu poruku.</p>';
    } else {
        chatKeys.sort((a, b) => {
            const timeA = privatnePoruke[a]?.slice(-1)[0]?.time;
            const timeB = privatnePoruke[b]?.slice(-1)[0]?.time;
            if (!timeA) return 1;
            if (!timeB) return -1;
            return new Date(timeB) - new Date(timeA);
        })
        .forEach(chatKey => {
            const partnerId = chatKey.split("-").find(id => id !== trenutniKorisnik.id);
            const partner = sviKorisnici.find(u => u.id == partnerId);
            if (!partner) return;

            const svePorukeChata = privatnePoruke[chatKey] || [];
            const zadnjaPorukaObj = svePorukeChata.length > 0 ? svePorukeChata[svePorukeChata.length - 1] : null;

            let zadnjaPorukaPreview = "Započnite razgovor";
            if (zadnjaPorukaObj) {
                if (zadnjaPorukaObj.imageUrl) {
                    zadnjaPorukaPreview = "📷 Slika";
                } else if (zadnjaPorukaObj.tekst) {
                    zadnjaPorukaPreview = zadnjaPorukaObj.tekst;
                }
            }

            const vrijemePoruke = zadnjaPorukaObj ? new Date(zadnjaPorukaObj.time).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }) : '';
            const neprocitaneCount = svePorukeChata.filter(m => !m.isRead && m.autorId == partner.id).length;
            const status = formatirajStatus(partner.lastActive);

            div.innerHTML += `
                <div class="chat-item" data-partner-name="${partner.ime.toLowerCase()}" onclick="pokreniPrivatniChat('${partner.id}')">
                    <div class="chat-profilna-wrapper">
                        <img src="${partner.slika || 'default_profile.png'}" class="chat-item-profilna" alt="profilna">
                        <span class="status-dot ${status.online ? 'online' : 'offline'}"></span>
                    </div>
                    <div class="chat-item-info">
                        <div class="chat-item-info-text">
                            <strong>${partner.ime}</strong>
                            <p class="status-text">${zadnjaPorukaPreview}</p>
                        </div>
                        <div class="chat-meta-info">
                            <span class="chat-vrijeme">${vrijemePoruke}</span>
                            ${neprocitaneCount > 0 ? `<span class="notification-badge-chat">${neprocitaneCount}</span>` : ""}
                        </div>
                    </div>
                </div>`;
        });
    }
    navigateTo('inboxPrikaz');
}


async function pokreniPrivatniChat(partnerId) {
    trenutniChatPartnerId = partnerId;
    const primalac = sviKorisnici.find(u => u.id === partnerId);
    if (!primalac) return;

    const chatHeaderInfoEl = document.querySelector('.chat-header-info');
    chatHeaderInfoEl.innerHTML = `
        <img id="chatPartnerSlika" src="${primalac.slika || 'default_profile.png'}" alt="Profilna slika" class="chat-partner-profilna">
        <div class="chat-info-text-wrapper">
            <h2 id="chatSaKorisnikom">${primalac.ime}</h2>
            <p id="chatPartnerStatus" class="status-text">${formatirajStatus(primalac.lastActive).text}</p>
        </div>
    `;

    document.getElementById("chatPartnerSlika").onclick = () => otvoriProfil(primalac.id);
    document.getElementById("chatSaKorisnikom").onclick = () => otvoriProfil(primalac.id);

    navigateTo('privatniChat');
    toggleAppUI(false);

    const chatKey = [trenutniKorisnik.id, trenutniChatPartnerId].sort().join("-");
    try {
        await authenticatedFetch('/api/messages', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatKey })
        });
        await dohvatiSvePoruke();
        azurirajNotifikacije();
    } catch (error) {
        console.error("Greška kod označavanja poruka kao pročitanih:", error);
    }

    const azurirajStatusSagovornika = () => {
        const svezPartner = sviKorisnici.find(u => u.id === partnerId);
        if (svezPartner) {
            document.getElementById("chatPartnerStatus").innerText = formatirajStatus(svezPartner.lastActive).text;
        }
    };

    if (chatStatusInterval) clearInterval(chatStatusInterval);
    chatStatusInterval = setInterval(azurirajStatusSagovornika, 5e3);
    azurirajStatusSagovornika();
    prikaziPrivatniLog();
}

async function posaljiPrivatno() {
    const privatniInput = document.getElementById("privatniInput");
    const tekst = privatniInput.value.trim();
    if (!tekst || !trenutniChatPartnerId) return;

    const posaljiBtn = document.getElementById('posaljiPrivatnoBtn');
    posaljiBtn.disabled = true;

    try {
        await authenticatedFetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiverId: trenutniChatPartnerId, content: tekst })
        });
        privatniInput.value = ""; privatniInput.style.height = 'auto';
        posaljiBtn.classList.remove('enabled');
        await dohvatiSvePoruke();
        prikaziPrivatniLog();
    } catch (error) {
        alert("Došlo je do greške pri slanju poruke.");
    } finally {
        posaljiBtn.disabled = false;
    }
}

function prikaziPrivatniLog() {
    if (!trenutniKorisnik || !trenutniChatPartnerId) return;
    const chatKey = [trenutniKorisnik.id, trenutniChatPartnerId].sort().join("-");
    const log = privatnePoruke[chatKey] || [];
    const div = document.getElementById("privatniChatLog");
    const fullImageModal = document.getElementById('fullImage');

    const sortiraniLog = log.slice().sort((a, b) => new Date(b.time) - new Date(a.time));

    div.innerHTML = sortiraniLog.map(msg => {
        const vrijeme = new Date(msg.time).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' });
        const klasaWrappera = msg.autorId === trenutniKorisnik.id ? "moja-poruka" : "tudja-poruka";

        let messageContent;
        if (msg.imageUrl) {
            messageContent = `<img src="${msg.imageUrl}" alt="Poslana slika" class="chat-image-thumbnail" onclick="openImageModal('${msg.imageUrl}')">`;
        } else {
            messageContent = `<span>${msg.tekst}</span>`;
        }

        return `
            <div class="poruka-wrapper ${klasaWrappera}">
                <div class="poruka-balon ${msg.imageUrl ? 'image-message-bubble' : ''}"> ${messageContent}
                </div>
                <span class="poruka-vrijeme">${vrijeme}</span>
            </div>
        `;
    }).join("");

    setTimeout(() => {
        div.scrollTop = 0;
    }, 100);
}

// NOVO: Funkcija za otvaranje modala za slike
function openImageModal(imageUrl) {
    const imageModal = document.getElementById('imageModal');
    const fullImage = document.getElementById('fullImage');
    fullImage.src = imageUrl;
    imageModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

async function dohvatiSveKorisnike() {
    try { const response = await authenticatedFetch('/api/users'); if (response.ok) sviKorisnici = await response.json(); }
    catch (error) { console.error("Greška mreže pri dohvaćanju korisnika:", error); }
}

async function dohvatiSvePijanke() {
    try { const response = await authenticatedFetch('/api/posts'); if (response.ok) svePijanke = await response.json(); }
    catch (error) { console.error("Greška mreže pri dohvaćanju pijanki:", error); }
}

async function dohvatiSvePoruke() {
    if (!localStorage.getItem("token")) return;
    try { const response = await authenticatedFetch('/api/messages'); if (response.ok) privatnePoruke = await response.json(); }
    catch (error) { console.error("Greška mreže pri dohvaćanju poruka:", error); }
}

function ocistiPijankePregled() {
    const div = document.getElementById("pijankePregled");
    if (div) div.innerHTML = "";
}

// --- NOVO: Funkcija za slanje slike privatno ---
async function posaljiSlikuPrivatno(imageData) {
    if (!imageData || !trenutniChatPartnerId) {
        alert("Nema slike za poslati ili nije odabran primatelj.");
        return;
    }

    const posaljiBtn = document.getElementById('posaljiPrivatnoBtn');

    try {
        const response = await authenticatedFetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiverId: trenutniChatPartnerId, imageUrl: imageData })
        });
        const data = await response.json();
        if (response.ok) {
            console.log("Slika uspješno poslana:", data);
            await dohvatiSvePoruke();
            prikaziPrivatniLog();
        } else {
            alert("Greška pri slanju slike: " + data.message);
        }
    } catch (error) {
        console.error("Došlo je do greške pri slanju slike:", error);
        alert("Došlo je do greške pri slanju slike.");
    } finally {
    }
}

// === NOVO: Funkcije za sustav pratitelja ===

/**
 * Dohvaća listu ID-jeva korisnika koje trenutni korisnik prati.
 * POZIVA: /api/users/me/following (GET)
 */
async function dohvatiMojaPracenja() {
    if (!trenutniKorisnik || !trenutniKorisnik.id) {
        myFollowings = [];
        return;
    }
    try {
        const response = await authenticatedFetch(`/api/users/me/following`);
        if (response.ok) {
            myFollowings = await response.json();
        } else {
            myFollowings = [];
            console.error("Greška pri dohvaćanju mojih praćenja:", response.statusText);
        }
    } catch (error) {
        myFollowings = [];
        console.error("Greška mreže pri dohvaćanju mojih praćenja:", error);
    }
}

/**
 * Dohvaća listu ID-jeva korisnika koji prate određenog korisnika.
 * Ažurira globalnu varijablu `profileFollowers`.
 * POZIVA: /api/users/[id]/followers (GET)
 * @param {string} userId - ID korisnika za kojeg se dohvaćaju pratitelji.
 */
async function dohvatiPratiteljeKorisnika(userId) {
    try {
        const response = await authenticatedFetch(`/api/users/${userId}/followers`);
        if (response.ok) {
            profileFollowers = await response.json();
        } else {
            profileFollowers = [];
            console.error(`Greška pri dohvaćanju pratitelja za korisnika ${userId}:`, response.statusText);
        }
    } catch (error) {
        profileFollowers = [];
        console.error(`Greška mreže pri dohvaćanju pratitelja za korisnika ${userId}:`, error);
    }
}

/**
 * Dohvaća listu ID-jeva korisnika koje određeni korisnik prati.
 * Ažurira globalnu varijablu `profileFollowing`.
 * POZIVA: /api/users/[id]/following (GET)
 * @param {string} userId - ID korisnika za kojeg se dohvaća koga on prati.
 */
async function dohvatiKogaKorisnikPrati(userId) {
    try {
        const response = await authenticatedFetch(`/api/users/${userId}/following`);
        if (response.ok) {
            profileFollowing = await response.json();
        } else {
            profileFollowing = [];
            console.error(`Greška pri dohvaćanju praćenja za korisnika ${userId}:`, response.statusText);
        }
    } catch (error) {
        profileFollowing = [];
        console.error(`Greška mreže pri dohvaćanju praćenja za korisnika ${userId}:`, error);
    }
}


/**
 * Prebacuje stanje praćenja/otpraćivanja za određenog korisnika.
 * POZIVA: /api/users/[id]/follow (PUT za follow, DELETE za unfollow)
 * @param {string} targetUserId - ID korisnika kojeg se prati/otprati.
 * @param {boolean} isCurrentlyFollowing - Trenutno stanje: true ako se prati, false inače.
 */
async function toggleFollow(targetUserId, isCurrentlyFollowing) {
    if (!trenutniKorisnik || !trenutniKorisnik.id) {
        alert("Morate biti prijavljeni da biste pratili korisnike.");
        return;
    }
    if (trenutniKorisnik.id === targetUserId) {
        alert("Ne možete pratiti samog sebe.");
        return;
    }

    const method = isCurrentlyFollowing ? 'DELETE' : 'PUT';
    const actionText = isCurrentlyFollowing ? 'Otprati' : 'Prati';

    try {
        const response = await authenticatedFetch(`/api/users/${targetUserId}/follow`, { method: method });
        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            await globalRefreshUI();
            otvoriProfil(targetUserId, true);
        } else {
            alert(`Greška pri ${actionText.toLowerCase()}anju: ${data.message}`);
        }
    } catch (error) {
        console.error(`Došlo je do greške pri ${actionText.toLowerCase()}anju korisnika:`, error);
        alert(`Došlo je do greške pri ${actionText.toLowerCase()}anju korisnika.`);
    }
}

/**
 * Prikazuje listu pratitelja/praćenih korisnika u novom modalu.
 * @param {string} profileId - ID korisnika čije pratitelje/praćenja želimo prikazati.
 * @param {string} profileName - Ime korisnika.
 * @param {string} listType - 'followers' ili 'following'.
 */
function showUserListModal(userId, userName, listType) {
    const list = listType === 'followers' ? profileFollowers : profileFollowing;
    const title = listType === 'followers' ? `Pratitelji ${userName}` : `Pratim ${userName}`;
    const userListHtml = document.getElementById('userListHtml');
    const userListModalTitle = document.getElementById('userListModalTitle');

    userListModalTitle.innerText = title;
    userListHtml.innerHTML = '';

    if (list.length === 0) {
        userListHtml.innerHTML = `<p style="text-align:center; color:#888; padding: 20px;">Nema ${listType === 'followers' ? 'pratitelja' : 'praćenja'}.</p>`;
    } else {
        list.forEach(id => {
            const user = sviKorisnici.find(u => u.id === id);
            if (user) {
                const isOnline = formatirajStatus(user.lastActive).online;
                userListHtml.innerHTML += `
                    <div class="user-list-item" onclick="closeUserListModal(); otvoriProfil('${user.id}')">
                        <div class="user-list-avatar-wrapper">
                            <img src="${user.slika || 'default_profile.png'}" alt="Profilna slika" class="user-list-avatar">
                            <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
                        </div>
                        <span class="user-list-name">${user.ime}</span>
                        ${trenutniKorisnik && trenutniKorisnik.id !== user.id ? `
                            <button class="user-list-follow-btn btn-${myFollowings.includes(user.id) ? 'secondary' : 'primary'}"
                                onclick="event.stopPropagation(); toggleFollow('${user.id}', ${myFollowings.includes(user.id)}).then(() => { closeUserListModal(); otvoriProfil('${userId}', true); showUserListModal('${userId}', '${userName}', '${listType}'); });">
                                ${myFollowings.includes(user.id) ? 'Otprati' : 'Prati'}
                            </button>` : ''}
                    </div>
                `;
            }
        });
    }

    document.getElementById('userListModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function showFollowers(userId, userName) {
    showUserListModal(userId, userName, 'followers');
}

function showFollowing(userId, userName) {
    showUserListModal(userId, userName, 'following');
}

function closeUserListModal() {
    document.getElementById('userListModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}


/**
 * Prikazuje sadržaj odabranog taba na profilu.
 * @param {string} tabId - ID taba za prikaz (npr. 'tabPosts', 'tabPhotos').
 * @param {HTMLElement} clickedButton - Gumb koji je kliknut.
 */
function showProfileTab(tabId, clickedButton) {
    document.querySelectorAll('.profile-content-tabs .tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    clickedButton.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    document.getElementById(tabId).classList.add('active');
}

/**
 * Generira HTML za objave korisnika.
 * @param {string} userId - ID korisnika čije objave želimo prikazati.
 * @returns {string} - HTML string objava.
 */
async function generateUserPostsHtml(userId) {
    const userPosts = svePijanke.filter(pijanka => pijanka.korisnikId === userId);

    if (userPosts.length === 0) {
        return `<p style="text-align:center; color:#888; padding: 20px;">Nema objava.</p>`;
    }

    let html = '<div class="profile-post-grid">';
    userPosts.forEach(post => {
        const postImageUrl = sviKorisnici.find(u => u.id === userId)?.slika || 'default_profile.png';

        html += `
            <div class="profile-post-item" onclick="alert('Prikaz detalja objave: ${post.opis}')">
                <img src="${postImageUrl}" alt="Objava">
                <p class="post-title">${post.opis}</p>
            </div>
        `;
    });
    html += '</div>';
    return html;
}