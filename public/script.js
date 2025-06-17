// ==================================
// ===   FINALNA SKRIPTA v3.0     ===
// ==================================

// --- Globalne varijable ---
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
let aktivniOverlay = null; // Prati koji je overlay otvoren ('overlayHost' ili 'chatOverlay')

// --- Pomoćne funkcije ---
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
            let { width, height } = img;
            if (width > maxWidth) {
                height *= (maxWidth / width);
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => {
            console.error("Greška pri učitavanju slike za kompresiju.");
            resolve(base64Image);
        };
    });
}

// --- Inicijalizacija aplikacije ---
window.addEventListener('DOMContentLoaded', async function() {
    // Listeneri za upload slika
    const slikaUploadEl = document.getElementById("slikaUpload");
    if (slikaUploadEl) {
        slikaUploadEl.addEventListener("change", handleSlikaUpload);
    }
    
    // Inicijalna provjera tokena
    const token = localStorage.getItem("token");
    const splashScreen = document.getElementById('splashScreen');
    document.querySelectorAll('.container, .app-shell, .overlay-screen').forEach(el => el.style.display = 'none');

    let appInitializedSuccessfully = false;
    if (token) {
        try {
            const response = await authenticatedFetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
                trenutniKorisnik = data.user;
                await Promise.all([dohvatiSveKorisnike(), dohvatiSvePijanke(), dohvatiSvePoruke()]);
                appInitializedSuccessfully = true;
            } else {
                localStorage.removeItem("token");
            }
        } catch (error) {
            console.error("Greška pri provjeri tokena:", error);
            localStorage.removeItem("token");
        }
    }

    setTimeout(() => {
        if (splashScreen) {
            splashScreen.style.opacity = '0';
            setTimeout(() => {
                splashScreen.style.display = 'none';
                if (appInitializedSuccessfully) {
                    pokreniAplikaciju();
                } else {
                    swap(null, 'intro');
                }
            }, 500);
        }
    }, 1500);
});


// --- Navigacija ---
function swap(hideId, showId) {
    if (hideId) {
        const hideElement = document.getElementById(hideId);
        if(hideElement) hideElement.classList.remove('active-screen');
    }
    const showElement = document.getElementById(showId);
    if (showElement) {
        showElement.style.display = 'flex';
        setTimeout(() => showElement.classList.add('active-screen'), 10);
    }
}

function prikaziOverlay(overlayId, contentHtml, title) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    
    let contentContainer, titleContainer;

    if (overlayId === 'chatOverlay') {
        contentContainer = overlay.querySelector('.chat-log-container');
        titleContainer = overlay.querySelector('#chatSaKorisnikom');
        const statusContainer = overlay.querySelector('#chatPartnerStatus');
        if (statusContainer) statusContainer.innerHTML = title.status || '';
        if (titleContainer) titleContainer.innerHTML = title.name || 'Chat';
    } else {
        contentContainer = overlay.querySelector('#overlayContent');
        titleContainer = overlay.querySelector('#overlayNaslov');
        if (titleContainer) titleContainer.innerHTML = title;
    }
    
    if (contentContainer) contentContainer.innerHTML = contentHtml;

    overlay.classList.add('active');
    aktivniOverlay = overlayId;
}

function zatvoriOverlay() {
    if (aktivniOverlay) {
        const overlay = document.getElementById(aktivniOverlay);
        if (overlay) overlay.classList.remove('active');
        
        if (aktivniOverlay === 'chatOverlay') {
            if (chatStatusInterval) clearInterval(chatStatusInterval);
            trenutniChatPartnerId = null;
        }
        aktivniOverlay = null;
    }
}


// --- Glavne Funkcije Aplikacije ---
function pokreniAplikaciju() {
    document.querySelectorAll('.container').forEach(el => {
        el.classList.remove('active-screen');
        el.style.display = 'none';
    });
    
    const mainAppView = document.getElementById('mainAppView');
    mainAppView.style.display = 'flex';
    setTimeout(() => mainAppView.classList.add('active-screen'), 10);
    
    const headerPic = document.getElementById('headerProfilePic');
    if (headerPic && trenutniKorisnik && trenutniKorisnik.slika) {
        headerPic.src = trenutniKorisnik.slika;
    }

    [activityInterval, globalDataRefreshInterval].forEach(i => i && clearInterval(i));
    activityInterval = setInterval(azurirajMojuAktivnost, 15000);
    globalDataRefreshInterval = setInterval(globalRefreshUI, 30000);

    azurirajMojuAktivnost();
    dohvatiLokaciju(() => {
        prikaziPijankePregled();
        azurirajNotifikacije();
    });
}

async function globalRefreshUI() {
    if (!trenutniKorisnik) return;
    await Promise.all([dohvatiSveKorisnike(), dohvatiSvePijanke(), dohvatiSvePoruke()]);
    prikaziPijankePregled();
    azurirajNotifikacije();

    if (aktivniOverlay === 'chatOverlay' && trenutniChatPartnerId) {
        prikaziPrivatniLog();
        const partner = sviKorisnici.find(u => u.id === trenutniChatPartnerId);
        if(partner) {
            const status = formatirajStatus(partner.lastActive);
            document.getElementById('chatPartnerStatus').innerText = status.text;
        }
    }
}

// --- Autentifikacija ---
async function registruj() {
    const ime = document.getElementById("ime").value.trim();
    const sifra = document.getElementById("sifra").value.trim();
    const instagram = document.getElementById("instagram").value.trim();
    const tiktok = document.getElementById("tiktok").value.trim();
    const opis = document.getElementById("opis").value.trim();
    const btn = document.getElementById('registracijaSubmitBtn');

    if (!ime || !sifra || !odabranaSlika) {
        return alert("Molimo popunite korisničko ime, lozinku i odaberite sliku!");
    }
    btn.disabled = true;
    btn.textContent = 'Registracija...';

    try {
        const compressedSlika = await compressImage(odabranaSlika);
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: ime, password: sifra, slika: compressedSlika, instagram, tiktok, opis })
        });
        const data = await response.json();
        if (response.ok) {
            await ulogujSe(ime, sifra);
        } else {
            alert("Greška: " + data.message);
        }
    } catch (error) {
        alert("Došlo je do greške pri registraciji.");
    } finally {
        btn.disabled = false;
        btn.textContent = 'Spremi';
    }
}

async function ulogujSe(username = null, password = null) {
    const ime = username || document.getElementById("loginIme").value.trim();
    const sifra = password || document.getElementById("loginSifra").value.trim();
    const btn = document.getElementById('loginSubmitBtn');

    if (!ime || !sifra) return alert("Unesite korisničko ime i lozinku!");
    btn.disabled = true;
    btn.textContent = 'Prijava...';

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
            await Promise.all([dohvatiSveKorisnike(), dohvatiSvePijanke(), dohvatiSvePoruke()]);
            pokreniAplikaciju();
        } else {
            alert("Greška: " + data.message);
        }
    } catch (error) {
        alert("Došlo je do greške pri prijavi.");
    } finally {
        btn.disabled = false;
        btn.textContent = 'Prijavi se';
    }
}

async function odjaviSe() {
    [activityInterval, chatStatusInterval, globalDataRefreshInterval].forEach(i => i && clearInterval(i));
    if (trenutniKorisnik?.id) {
        await azurirajMojuAktivnost(true);
    }
    localStorage.removeItem("token");
    trenutniKorisnik = null;
    
    document.getElementById('mainAppView').classList.remove('active-screen');
    setTimeout(() => {
        document.getElementById('mainAppView').style.display = 'none';
        swap(null, 'intro');
    }, 300);
}


// --- Prikaz Sadržaja (Overlay-i) ---
async function otvoriProfil(korisnikId, event) {
    if (event) event.preventDefault();
    if (!korisnikId) return;

    prikaziOverlay('overlayHost', '<p style="text-align: center; padding-top: 40px;">Učitavam profil...</p>', 'Profil');
    
    try {
        const response = await authenticatedFetch(`/api/users/${korisnikId}`);
        if (!response.ok) throw new Error('Korisnik nije pronađen.');
        
        const korisnik = await response.json();
        const isMyProfile = trenutniKorisnik && korisnik.id === trenutniKorisnik.id;

        const actionButtons = isMyProfile 
            ? `<button class="form-button" onclick="prikaziEditProfila()">Uredi profil</button>
               <button class="form-button btn-secondary" onclick="odjaviSe()">Odjavi se</button>`
            : `<button class="form-button" onclick="pokreniPrivatniChat('${korisnik.id}')">💬 Pošalji poruku</button>`;
        
        const contentHtml = `
            <div class="profile-view">
                <img src="${korisnik.slika || 'https://placehold.co/100'}" class="profilna-slika" alt="Profilna">
                <h3>${korisnik.ime}</h3>
                <p class="opis">${korisnik.opis || "Nema opisa."}</p>
                <div class="social-links">${prikaziMreze(korisnik)}</div>
                <div class="profile-actions">${actionButtons}</div>
            </div>`;
        document.getElementById('overlayContent').innerHTML = contentHtml;
    } catch (error) {
        document.getElementById('overlayContent').innerHTML = `<p style="text-align: center;">${error.message}</p>`;
    }
}

async function prikaziEditProfila() {
    if (!trenutniKorisnik) return;
    const { id, ime, opis, instagram, tiktok, slika } = trenutniKorisnik;

    const contentHtml = `
        <div style="text-align:center;">
            <img id="previewEditSlike" src="${slika || 'https://placehold.co/100'}" class="profilna-slika" style="margin-bottom: 20px;" />
        </div>
        <input id="editIme" placeholder="Korisničko ime" value="${ime || ''}" />
        <textarea id="editOpis" placeholder="O meni..." rows="3">${opis || ''}</textarea>
        <input id="editInstagram" placeholder="Instagram korisničko ime" value="${instagram || ''}" />
        <input id="editTiktok" placeholder="TikTok korisničko ime" value="${tiktok || ''}" />
        <label style="font-size:14px; display:block; margin-bottom:5px;">Promijeni profilnu sliku:</label>
        <input type="file" id="editSlikaUpload" accept="image/*" />
        <button id="sacuvajProfilBtn" class="form-button" onclick="sacuvajProfil()">Spremi promjene</button>
    `;
    prikaziOverlay('overlayHost', contentHtml, 'Uredi profil');

    // Ponovno dodaj event listener za upload
    odabranaEditSlika = null;
    const editSlikaUploadEl = document.getElementById("editSlikaUpload");
    if (editSlikaUploadEl) {
        editSlikaUploadEl.addEventListener("change", handleEditSlikaUpload);
    }
}

async function prikaziInbox() {
    await dohvatiSvePoruke();
    const chatKeys = Object.keys(privatnePoruke).filter(key => key.includes(trenutniKorisnik.id));
    
    let contentHtml;
    if (chatKeys.length === 0) {
        contentHtml = '<p style="text-align:center; padding-top: 40px;">Nemaš još nijednu poruku.</p>';
    } else {
        const sortedChats = chatKeys.sort((a, b) => {
            const lastMsgA = privatnePoruke[a].slice(-1)[0];
            const lastMsgB = privatnePoruke[b].slice(-1)[0];
            return new Date(lastMsgB.time) - new Date(lastMsgA.time);
        });

        contentHtml = sortedChats.map(chatKey => {
            const partnerId = chatKey.replace(trenutniKorisnik.id, '').replace('-', '');
            const partner = sviKorisnici.find(u => u.id === partnerId);
            if (!partner) return '';

            const neprocitane = privatnePoruke[chatKey].some(m => !m.isRead && m.autorId === partner.id);
            return `
                <div class="chat-item" onclick="pokreniPrivatniChat('${partner.id}')">
                    <img src="${partner.slika || 'https://placehold.co/100'}" class="profilna-slika" alt="profilna">
                    <div class="chat-item-info">
                        <strong>${partner.ime}</strong>
                        <p class="status-text">${formatirajStatus(partner.lastActive).text}</p>
                    </div>
                    ${neprocitane ? '<div class="notification-dot-chat"></div>' : ''}
                </div>
            `;
        }).join('');
    }
    prikaziOverlay('overlayHost', `<div id="listaChatova">${contentHtml}</div>`, 'Poruke');
}

function pokaziObjavu() {
    const contentHtml = `
        <textarea id="opisPijanke" placeholder="Opis pijanke (npr: nas 5 kod mene 🔥)" rows="5"></textarea>
        <button class="form-button" onclick="objaviPijanku()">Objavi</button>`;
    prikaziOverlay('overlayHost', contentHtml, 'Objavi pijanku');
}

async function pokreniPrivatniChat(partnerId) {
    trenutniChatPartnerId = partnerId;
    const partner = sviKorisnici.find(u => u.id === partnerId);
    if (!partner) return alert("Korisnik nije pronađen.");

    const chatKey = [trenutniKorisnik.id, partnerId].sort().join("-");
    prikaziOverlay('chatOverlay', '<div style="display:flex; flex-direction:column-reverse;"></div>', { name: partner.ime, status: formatirajStatus(partner.lastActive).text });
    
    try {
        await authenticatedFetch('/api/messages', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatKey })
        });
        await dohvatiSvePoruke();
        azurirajNotifikacije();
        prikaziPrivatniLog();
    } catch (error) {
        console.error("Greška pri označavanju poruka kao pročitanih:", error);
    }
    
    if (chatStatusInterval) clearInterval(chatStatusInterval);
    chatStatusInterval = setInterval(globalRefreshUI, 5000);
}


// --- Logika Spremanja i Slanja Podataka ---
async function sacuvajProfil() {
    const novoIme = document.getElementById("editIme").value.trim();
    if (!novoIme) return alert("Ime ne može biti prazno!");

    const btn = document.getElementById('sacuvajProfilBtn');
    btn.disabled = true;
    btn.textContent = 'Spremam...';
    
    const updateData = {
        username: novoIme,
        opis: document.getElementById("editOpis").value.trim(),
        instagram: document.getElementById("editInstagram").value.trim(),
        tiktok: document.getElementById("editTiktok").value.trim()
    };

    if (odabranaEditSlika) {
        updateData.slika = await compressImage(odabranaEditSlika);
    }

    try {
        const response = await authenticatedFetch(`/api/users/${trenutniKorisnik.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        const data = await response.json();
        if (response.ok) {
            await globalRefreshUI();
            // Ažuriraj lokalnog korisnika i sliku u headeru
            trenutniKorisnik = {...trenutniKorisnik, ...updateData};
            document.getElementById('headerProfilePic').src = trenutniKorisnik.slika;
            zatvoriOverlay();
        } else {
            alert("Greška: " + data.message);
        }
    } catch (error) {
        alert("Došlo je do greške pri spremanju profila.");
    } finally {
        btn.disabled = false;
        btn.textContent = 'Spremi promjene';
    }
}

async function objaviPijanku() {
    const opis = document.getElementById("opisPijanke").value.trim();
    if (!opis) return alert("Unesite opis pijanke!");

    if (!mojPoz) {
        return dohvatiLokaciju(() => {
            if (mojPoz) objaviPijanku();
        });
    }
    
    const btn = document.querySelector('#overlayContent button');
    btn.disabled = true;
    btn.textContent = 'Objavljujem...';

    try {
        const response = await authenticatedFetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ opis, lat: mojPoz.lat, lon: mojPoz.lon })
        });
        if (response.ok) {
            await dohvatiSvePijanke();
            prikaziPijankePregled();
            zatvoriOverlay();
        } else {
            const data = await response.json();
            alert("Greška: " + data.message);
        }
    } catch (error) {
        alert("Došlo je do greške pri objavi.");
    } finally {
        btn.disabled = false;
        btn.textContent = 'Objavi';
    }
}

async function posaljiPrivatno() {
    const tekst = document.getElementById("privatniInput").value.trim();
    if (!tekst || !trenutniChatPartnerId) return;

    const btn = document.getElementById('posaljiPrivatnoBtn');
    btn.disabled = true;

    try {
        const response = await authenticatedFetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiverId: trenutniChatPartnerId, content: tekst })
        });
        if (response.ok) {
            document.getElementById("privatniInput").value = "";
            await dohvatiSvePoruke();
            prikaziPrivatniLog();
        } else {
            const data = await response.json();
            alert("Greška pri slanju: " + data.message);
        }
    } catch (error) {
        alert("Došlo je do greške pri slanju poruke.");
    } finally {
        btn.disabled = false;
    }
}


// --- Prikaz Podataka i UI Ažuriranja ---
function prikaziPijankePregled() {
    const div = document.getElementById("pijankePregled");
    if (!div) return;
    if (svePijanke.length === 0) {
        div.innerHTML = '<p style="text-align:center; padding-top: 40px;">Trenutno nitko ne pije. Budi prvi!</p>';
        return;
    }
    div.innerHTML = svePijanke.map(pijanka => {
        const autor = sviKorisnici.find(u => u.id === pijanka.korisnikId);
        if (!autor) return '';
        const isMyPost = trenutniKorisnik && autor.id === trenutniKorisnik.id;
        return `
            <div class="pijanka-card">
                <div class="pijanka-header" onclick="otvoriProfil('${autor.id}')">
                    <img src="${autor.slika || 'https://placehold.co/100'}" class="pijanka-profilna-slika">
                    <div class="pijanka-info">
                        <strong>${autor.ime}</strong>
                        <p class="status-text">${distKM(mojPoz, pijanka)}km od tebe</p>
                    </div>
                    ${isMyPost ? `<button class="delete-btn" onclick="obrisiPijanku('${pijanka.id}', event)">🗑️</button>` : ""}
                </div>
                <div class="pijanka-opis"><p>${pijanka.opis}</p></div>
            </div>`;
    }).join('');
}

function prikaziPrivatniLog() {
    const chatKey = [trenutniKorisnik.id, trenutniChatPartnerId].sort().join("-");
    const log = privatnePoruke[chatKey] || [];
    const div = document.getElementById("privatniChatLog");
    if (!div) return;
    
    const logHtml = log.map(msg => `
        <div class="msg-bubble ${msg.autorId === trenutniKorisnik.id ? "moja-poruka" : "tudja-poruka"}">
            ${msg.tekst}
        </div>`).join('');
    
    div.innerHTML = `<div>${logHtml}</div>`;
}

function azurirajNotifikacije() {
    const dot = document.getElementById("inbox-notification-dot");
    if (!dot) return;
    let neprocitane = 0;
    if (trenutniKorisnik?.id) {
        for (const key in privatnePoruke) {
            if (key.includes(trenutniKorisnik.id)) {
                neprocitane += privatnePoruke[key].filter(msg => !msg.isRead && msg.autorId !== trenutniKorisnik.id).length;
            }
        }
    }
    dot.style.display = neprocitane > 0 ? 'block' : 'none';
}


// --- Ostale Pomoćne Funkcije ---
function handleSlikaUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            odabranaSlika = e.target.result;
            const preview = document.getElementById("previewSlike");
            if (preview) {
                preview.src = odabranaSlika;
                preview.style.display = "block";
            }
        };
        reader.readAsDataURL(file);
    }
}
function handleEditSlikaUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            odabranaEditSlika = e.target.result;
            document.getElementById("previewEditSlike").src = odabranaEditSlika;
        };
        reader.readAsDataURL(file);
    }
}

function proveriPrihvatanje() {
    document.getElementById('nastaviBtn').disabled = !document.getElementById('prihvatamPravila').checked;
}

function distKM(p1, p2) {
    if (!p1 || !p2) return "? ";
    const R = 6371;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lon - p1.lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

async function azurirajMojuAktivnost(loggingOut = false) {
    if (!trenutniKorisnik?.id) return;
    try {
        await authenticatedFetch(`/api/users/${trenutniKorisnik.id}/activity`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loggingOut })
        });
    } catch (error) {
        console.error("Greška pri ažuriranju aktivnosti:", error);
    }
}

function dohvatiLokaciju(callback) {
    if (!navigator.geolocation) {
        alert("Geolokacija nije podržana.");
        return callback && callback();
    }
    navigator.geolocation.getCurrentPosition(pos => {
        mojPoz = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        callback && callback();
    }, () => {
        alert("Nismo dobili geolokaciju. Bez lokacije ne možete objavljivati.");
        callback && callback();
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}

async function obrisiPijanku(pijankaId, event) {
    event.stopPropagation();
    if (confirm("Jeste li sigurni da želite obrisati ovu objavu?")) {
        try {
            const response = await authenticatedFetch(`/api/posts?postId=${pijankaId}`, { method: 'DELETE' });
            if (response.ok) {
                await dohvatiSvePijanke();
                prikaziPijankePregled();
            } else {
                alert("Greška pri brisanju objave.");
            }
        } catch (error) {
            alert("Došlo je do greške pri brisanju.");
        }
    }
}


// --- Funkcije za Dohvaćanje Podataka s API-ja ---
async function dohvatiSveKorisnike() {
    try {
        const response = await authenticatedFetch('/api/users');
        sviKorisnici = response.ok ? await response.json() : [];
    } catch (error) {
        console.error("Greška mreže pri dohvaćanju korisnika:", error);
    }
}
async function dohvatiSvePijanke() {
    try {
        const response = await authenticatedFetch('/api/posts');
        svePijanke = response.ok ? await response.json() : [];
    } catch (error) {
        console.error("Greška mreže pri dohvaćanju pijanki:", error);
    }
}
async function dohvatiSvePoruke() {
    try {
        const response = await authenticatedFetch('/api/messages');
        privatnePoruke = response.ok ? await response.json() : {};
    } catch (error) {
        console.error("Greška mreže pri dohvaćanju poruka:", error);
    }
}
