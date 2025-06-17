// ==================================
// ===   FINALNA SKRIPTA v5.2     ===
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
let prethodniEkran = 'lokacijePrikaz';

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
    const slikaUploadEl = document.getElementById("slikaUpload");
    if (slikaUploadEl) {
        slikaUploadEl.addEventListener("change", handleSlikaUpload);
    }
    
    const token = localStorage.getItem("token");
    const splashScreen = document.getElementById('splashScreen');
    document.querySelectorAll('.container').forEach(el => el.style.display = 'none');
    splashScreen.style.display = 'flex';
    splashScreen.classList.add('active-screen');

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
                splashScreen.classList.remove('active-screen');
                if (appInitializedSuccessfully) {
                    pokreniAplikaciju();
                } else {
                    swap(null, 'intro');
                }
            }, 300);
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
    if (hideId && showId !== prethodniEkran) {
        prethodniEkran = hideId;
    }
}

function zatvoriEkran(trenutniEkranId) {
    swap(trenutniEkranId, prethodniEkran);
    if (trenutniEkranId === 'privatniChat') {
        if (chatStatusInterval) clearInterval(chatStatusInterval);
        trenutniChatPartnerId = null;
    }
}


// --- Glavne Funkcije Aplikacije ---
function pokreniAplikaciju() {
    document.querySelectorAll('.container').forEach(el => {
        if(el.id !== 'lokacijePrikaz') el.classList.remove('active-screen');
    });
    swap(null, 'lokacijePrikaz');
    
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
    const trenutnoAktivni = document.querySelector('.container.active-screen')?.id;
    await Promise.all([dohvatiSveKorisnike(), dohvatiSvePijanke(), dohvatiSvePoruke()]);

    if(trenutnoAktivni === 'lokacijePrikaz') prikaziPijankePregled();
    azurirajNotifikacije();

    if (trenutnoAktivni === 'privatniChat' && trenutniChatPartnerId) {
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
    
    const trenutnoAktivni = document.querySelector('.container.active-screen');
    swap(trenutnoAktivni.id, 'intro');
}


// --- Prikaz Sadržaja ---
async function otvoriProfil(korisnikId) {
    if (!korisnikId) return;

    const contentDiv = document.getElementById('genericScreenContent');
    document.getElementById('genericScreenTitle').innerText = 'Profil';
    contentDiv.innerHTML = '<p style="text-align: center; padding-top: 40px;">Učitavam profil...</p>';
    swap(document.querySelector('.container.active-screen').id, 'genericScreen');
    
    try {
        const response = await authenticatedFetch(`/api/users/${korisnikId}`);
        if (!response.ok) throw new Error('Korisnik nije pronađen.');
        
        const korisnik = await response.json();
        const isMyProfile = trenutniKorisnik && korisnik.id === trenutniKorisnik.id;

        const actionButtons = isMyProfile 
            ? `<button class="form-button" onclick="prikaziEditProfila()">Uredi profil</button>
               <button class="form-button btn-secondary" onclick="odjaviSe()">Odjavi se</button>`
            : `<button class="form-button" onclick="pokreniPrivatniChat('${korisnik.id}')">💬 Pošalji poruku</button>`;
        
        contentDiv.innerHTML = `
            <div class="profile-view">
                <img src="${korisnik.slika || 'https://placehold.co/100'}" class="profilna-slika" alt="Profilna">
                <h3>${korisnik.ime}</h3>
                <p class="opis">${korisnik.opis || "Nema opisa."}</p>
                <div class="social-links">${prikaziMreze(korisnik)}</div>
                <div class="profile-actions">${actionButtons}</div>
            </div>`;
    } catch (error) {
        contentDiv.innerHTML = `<p style="text-align: center;">${error.message}</p>`;
    }
}

async function prikaziEditProfila() {
    if (!trenutniKorisnik) return;
    const { ime, opis, instagram, tiktok, slika } = trenutniKorisnik;
    const contentDiv = document.getElementById('genericScreenContent');
    document.getElementById('genericScreenTitle').innerText = 'Uredi profil';

    contentDiv.innerHTML = `
        <div style="text-align:center;">
            <img id="previewEditSlike" src="${slika || 'https://placehold.co/100'}" class="profilna-slika" style="margin-bottom: 20px;" />
        </div>
        <input id="editIme" placeholder="Korisničko ime" value="${ime || ''}" />
        <textarea id="editOpis" placeholder="O meni..." rows="3">${opis || ''}</textarea>
        <input id="editInstagram" placeholder="Instagram korisničko ime" value="${instagram || ''}" />
        <input id="editTiktok" placeholder="TikTok korisničko ime" value="${tiktok || ''}" />
        <label>Promijeni profilnu sliku:</label>
        <input type="file" id="editSlikaUpload" accept="image/*" />
        <button id="sacuvajProfilBtn" class="form-button" onclick="sacuvajProfil()">Spremi promjene</button>
    `;

    odabranaEditSlika = null;
    const editSlikaUploadEl = document.getElementById("editSlikaUpload");
    if (editSlikaUploadEl) {
        editSlikaUploadEl.addEventListener("change", handleEditSlikaUpload);
    }
}

async function prikaziInbox() {
    await dohvatiSvePoruke();
    const listaChatova = document.getElementById('listaChatova');
    const chatKeys = Object.keys(privatnePoruke).filter(key => key.includes(trenutniKorisnik.id));
    
    if (chatKeys.length === 0) {
        listaChatova.innerHTML = '<p style="text-align:center; padding-top: 40px;">Nemaš još nijednu poruku.</p>';
    } else {
        const sortedChats = chatKeys.sort((a, b) => {
            const lastMsgA = privatnePoruke[a].slice(-1)[0];
            const lastMsgB = privatnePoruke[b].slice(-1)[0];
            if (!lastMsgA) return 1;
            if (!lastMsgB) return -1;
            return new Date(lastMsgB.time) - new Date(lastMsgA.time);
        });

        listaChatova.innerHTML = sortedChats.map(chatKey => {
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
    swap('lokacijePrikaz', 'inboxPrikaz');
}

function pokaziObjavu() {
    const contentDiv = document.getElementById('genericScreenContent');
    document.getElementById('genericScreenTitle').innerText = 'Objavi pijanku';
    contentDiv.innerHTML = `
        <textarea id="opisPijanke" placeholder="Opis pijanke (npr: nas 5 kod mene 🔥)" rows="5"></textarea>
        <button class="form-button" onclick="objaviPijanku()">Objavi</button>`;
    swap('lokacijePrikaz', 'genericScreen');
}

async function pokreniPrivatniChat(partnerId) {
    trenutniChatPartnerId = partnerId;
    const partner = sviKorisnici.find(u => u.id === partnerId);
    if (!partner) return alert("Korisnik nije pronađen.");

    document.getElementById('chatSaKorisnikom').innerText = partner.ime;
    document.getElementById('chatPartnerStatus').innerText = formatirajStatus(partner.lastActive).text;
    document.getElementById('privatniChatLog').innerHTML = '';
    swap(document.querySelector('.container.active-screen').id, 'privatniChat');
    
    const chatKey = [trenutniKorisnik.id, partnerId].sort().join("-");
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
            trenutniKorisnik = { ...trenutniKorisnik, ...data.user };
            document.getElementById('headerProfilePic').src = trenutniKorisnik.slika;
            zatvoriEkran('genericScreen');
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
    
    const btn = document.querySelector('#genericScreenContent button');
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
            zatvoriEkran('genericScreen');
        } else {
            const data = await response.json();
            alert("Greška: " + data.message);
        }
    } catch (error) {
        alert("Došlo je do greške pri objavi.");
    } finally {
        if(btn){
            btn.disabled = false;
            btn.textContent = 'Objavi';
        }
    }
}

async function posaljiPrivatno() {
    const privatniInputEl = document.getElementById("privatniInput");
    const tekst = privatniInputEl.value.trim();
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
            privatniInputEl.value = "";
            privatniInputEl.style.height = 'auto';
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
                <div class="pijanka-opis"><p>${pijanka.opis.replace(/\n/g, '<br>')}</p></div>
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
            ${msg.tekst.replace(/\n/g, '<br>')}
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

function formatirajStatus(isoTimestamp) {
    if (!isoTimestamp) return { text: "Offline", online: false };
    const diffSekunde = Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 1000);
    if (diffSekunde < 60) return { text: "Online", online: true };
    if (diffSekunde < 3600) return { text: `viđen/a prije ${Math.floor(diffSekunde/60)} min`, online: false };
    if (diffSekunde < 86400) return { text: `viđen/a prije ${Math.floor(diffSekunde/3600)} h`, online: false };
    return { text: `viđen/a prije ${Math.floor(diffSekunde/86400)} dana`, online: false };
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

function prikaziMreze(p) {
    let s = "";
    if (p.instagram) s += `<a href="https://instagram.com/${p.instagram}" target="_blank"><svg fill="#a0a0a0" height="28px" width="28px" version="1.1" id="Icons" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M349.3,512c-29,0-32.9-1.2-44.6-2.6c-12-1.4-23.9-4.2-35.7-8.8c-11.8-4.6-22.4-10.4-33.1-21.1c-10.7-10.7-16.5-21.3-21.1-33.1c-4.6-11.8-7.4-23.7-8.8-35.7c-1.4-11.7-2.6-15.6-2.6-44.6s1.2-32.9,2.6-44.6c1.4-12,4.2-23.9,8.8-35.7c4.6-11.8,10.4-22.4,21.1-33.1c10.7-10.7,21.3-16.5,33.1-21.1c11.8-4.6,23.7-7.4,35.7-8.8c11.7-1.4,15.6-2.6,44.6-2.6s32.9,1.2,44.6,2.6c12,1.4,23.9,4.2,35.7,8.8c11.8,4.6,22.4,10.4,33.1,21.1c10.7,10.7,16.5,21.3,21.1,33.1c4.6,11.8,7.4,23.7,8.8,35.7c1.4,11.7,2.6,15.6,2.6,44.6s-1.2,32.9-2.6,44.6c-1.4,12-4.2-23.9-8.8-35.7c-4.6,11.8-10.4,22.4-21.1,33.1c-10.7,10.7-21.3,16.5-33.1,21.1c-11.8,4.6-23.7,7.4-35.7,8.8C382.2,510.8,378.3,512,349.3,512z M349.3,448c27.8,0,31.2-1.2,42.2-2.5c10.8-1.3,20-3.8,28.3-7.1c9.2-3.6,16.8-8.8,24.4-16.4c7.6-7.6,12.8-15.2,16.4-24.4c3.3-8.3,5.8-17.5,7.1-28.3c1.3-11,2.5-14.4,2.5-42.2s-1.2-31.2-2.5-42.2c-1.3-10.8-3.8-20-7.1-28.3c-3.6-9.2-8.8-16.8-16.4-24.4c-7.6-7.6-15.2-12.8-24.4-16.4c-8.3-3.3-17.5-5.8-28.3-7.1c-11-1.3-14.4-2.5-42.2-2.5s-31.2,1.2-42.2,2.5c-10.8,1.3-20,3.8-28.3,7.1c-9.2,3.6-16.8,8.8-24.4,16.4c-7.6-7.6-12.8,15.2-16.4,24.4c-3.3,8.3-5.8,17.5-7.1,28.3c-1.3,11-2.5,14.4-2.5,42.2s1.2,31.2,2.5,42.2c1.3,10.8,3.8,20,7.1,28.3c3.6,9.2,8.8,16.8,16.4,24.4c7.6,7.6,15.2,12.8,24.4,16.4c8.3,3.3,17.5,5.8,28.3,7.1C318.1,446.8,321.5,448,349.3,448z M349.3,384c-35.3,0-64-28.7-64-64s28.7-64,64-64s64,28.7,64,64S384.6,384,349.3,384z M349.3,288c-17.6,0-32,14.4-32,32s14.4,32,32,32s32-14.4,32-32S366.9,288,349.3,288z M418.2,128.8c-11.5,0-20.8,9.3-20.8,20.8s9.3,20.8,20.8,20.8s20.8-9.3,20.8-20.8S429.7,128.8,418.2,128.8z"/></svg></a>`;
    if (p.tiktok) s += `<a href="https://tiktok.com/@${p.tiktok}" target="_blank"><svg fill="#a0a0a0" height="28px" width="28px" version="1.1" id="Icons" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M349.3,0H218.7C196.5,0,178.7,17.8,178.7,40v330.7c0,82.8-67.2,150-150,150C12.8,520.7,0,507.8,0,491.9V349.3C0,333.5,12.8,320.7,28.7,320.7c12.3,0,22.8,7.9,26.9,19.3c4.2-1.1,8.5-2,13-2.6v-74c-20.5-2.2-38.3-12-51.2-26.9c-4.2-4.9-6.3-10.7-6.3-16.9c0-15.8,12.8-28.7,28.7-28.7h80c15.8,0,28.7,12.8,28.7,28.7c0,15.8-12.8,28.7-28.7,28.7h-40v64h40c35.3,0,64,28.7,64,64v85.3c0,27.6,22.4,50,50,50s50-22.4,50-50V160H218.7V64h130.7c15.8,0,28.7,12.8,28.7,28.7c0,15.8-12.8,28.7-28.7,28.7h-37.3v133.3c0,82.8-67.2,150-150,150c-12.3,0-23.7-1.5-34.7-4.2V160h106.7c15.8,0,28.7-12.8,28.7-28.7V40c0-22.2,17.8-40,40-40h130.7c15.8,0,28.7-12.8,28.7-28.7C512,12.8,499.2,0,483.3,0H349.3z"/></svg></a>`;
    return s || '<p class="status-text">Nema društvenih mreža.</p>';
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
