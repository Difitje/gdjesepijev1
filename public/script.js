// public/script.js - VERZIJA S NOVIM HEADEROM I PROFILOM

// Globalne varijale
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
let prethodniEkran = "lokacijePrikaz";
let prethodniInboxEkran = "lokacijePrikaz"; // Pratimo odakle je inbox otvoren


async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }
    return fetch(url, options);
}

function compressImage(base64Image, maxWidth = 400, quality = 0.8) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Image;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = height * (maxWidth / width);
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(base64Image);
    });
}

window.addEventListener('DOMContentLoaded', async function() {
    const token = localStorage.getItem("token");
    const splashScreen = document.getElementById('splashScreen');

    document.querySelectorAll('.container').forEach(el => {
        if (el.id !== 'splashScreen') el.style.display = 'none';
    });

    let appInitializedSuccessfully = false;
    if (token) {
        try {
            const response = await authenticatedFetch('/api/auth/me');
            if (response.ok) {
                trenutniKorisnik = (await response.json()).user;
                await Promise.all([
                    dohvatiSveKorisnike(),
                    dohvatiSvePijanke(),
                    dohvatiSvePoruke()
                ]);
                appInitializedSuccessfully = true;
            } else {
                localStorage.removeItem("token");
            }
        } catch (error) {
            localStorage.removeItem("token");
        }
    }

    setTimeout(() => {
        if (splashScreen) {
           splashScreen.style.animation = 'fadeOutSplash 0.5s ease-out forwards';
           setTimeout(() => {
              splashScreen.remove();
              if (appInitializedSuccessfully) pokreniAplikaciju();
              else swap(null, 'intro');
           }, 500);
        }
    }, 2000);
});

function swap(hideId, showId) {
    const hideElement = document.getElementById(hideId);
    const showElement = document.getElementById(showId);
    if (!showElement) return;

    if (hideElement) {
        hideElement.classList.remove('active-screen');
        hideElement.style.display = 'none';
    }
    showElement.style.display = 'flex';
    setTimeout(() => showElement.classList.add('active-screen'), 10);
}

function zatvoriEkran(trenutniEkranId, povratniEkranId) {
    swap(trenutniEkranId, povratniEkranId);
    if (trenutniEkranId === 'privatniChat') {
        if (chatStatusInterval) clearInterval(chatStatusInterval);
        trenutniChatPartnerId = null;
        document.getElementById("privatniInput").value = "";
    }
}

function proveriPrihvatanje() {
    document.getElementById('nastaviBtn').disabled = !document.getElementById('prihvatamPravila').checked;
}

async function globalRefreshUI() {
    if (!trenutniKorisnik) return;
    await Promise.all([
        dohvatiSveKorisnike(),
        dohvatiSvePijanke(),
        dohvatiSvePoruke()
    ]);
    if (document.getElementById("lokacijePrikaz")?.classList.contains('active-screen')) {
        prikaziPijankePregled();
        // Ažuriranje slike profila u headeru
        const headerProfileIcon = document.getElementById('headerProfileIcon');
        if (headerProfileIcon && trenutniKorisnik) {
            const ja = sviKorisnici.find(u => u.id === trenutniKorisnik.id);
            if(ja) headerProfileIcon.src = ja.slika || 'default_profile.png';
        }
    }
    if (document.getElementById("inboxPrikaz")?.classList.contains('active-screen')) {
        prikaziInbox(prethodniInboxEkran);
    }
    if (document.getElementById("privatniChat")?.classList.contains('active-screen') && trenutniChatPartnerId) {
        prikaziPrivatniLog();
    }
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
                    document.getElementById("previewSlikes").src = odabranaSlika;
                    document.getElementById("previewSlikes").style.display = "block";
                };
                reader.readAsDataURL(file);
            }
        });
    }

    const editSlikaUploadEl = document.getElementById("editSlikaUpload");
    if (editSlikaUploadEl) {
        editSlikaUploadEl.addEventListener("change", function() {
             const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = e => {
                    odabranaEditSlika = e.target.result;
                    document.getElementById("previewEditSlike").src = odabranaEditSlika;
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

async function registruj() {
    const ime = document.getElementById("ime").value.trim();
    const sifra = document.getElementById("sifra").value.trim();
    if (!ime || !sifra || !odabranaSlika) return alert("Molimo popunite korisničko ime, lozinku i odaberite sliku!");
    
    const registrujBtn = document.getElementById('registracijaSubmitBtn');
    registrujBtn.disabled = true;
    
    try {
        const compressedSlika = await compressImage(odabranaSlika);
        const instagram = document.getElementById("instagram").value.trim();
        const tiktok = document.getElementById("tiktok").value.trim();
        const opis = document.getElementById("opis").value.trim();
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: ime, password: sifra, slika: compressedSlika, instagram, tiktok, opis })
        });
        const data = await response.json();
        if (response.ok) await ulogujSe(ime, sifra);
        else alert("Greška: " + data.message);
    } catch (error) {
        alert("Došlo je do greške.");
    } finally {
        registrujBtn.disabled = false;
    }
}

async function ulogujSe(username = null, password = null) {
    const ime = username || document.getElementById("loginIme").value.trim();
    const sifra = password || document.getElementById("loginSifra").value.trim();
    if (!ime || !sifra) return alert("Unesite korisničko ime i lozinku!");

    const loginBtn = document.getElementById('loginSubmitBtn');
    loginBtn.disabled = true;

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
        alert("Došlo je do greške.");
    } finally {
        loginBtn.disabled = false;
    }
}

async function odjaviSe() {
    if (activityInterval) clearInterval(activityInterval);
    if (globalDataRefreshInterval) clearInterval(globalDataRefreshInterval);
    if (trenutniKorisnik) await azurirajMojuAktivnost(true);
    localStorage.removeItem("token");
    trenutniKorisnik = null;
    swap(document.querySelector('.container.active-screen').id, 'intro');
}

function pokreniAplikaciju() {
    swap(document.querySelector('.container.active-screen')?.id, 'lokacijePrikaz');
    if (activityInterval) clearInterval(activityInterval);
    if (globalDataRefreshInterval) clearInterval(globalDataRefreshInterval);
    activityInterval = setInterval(azurirajMojuAktivnost, 15e3);
    globalDataRefreshInterval = setInterval(globalRefreshUI, 30e3);
    azurirajMojuAktivnost();
    dohvatiLokaciju(globalRefreshUI);
}

// ** NOVO: Funkcija koja otvara tvoj profil **
function otvoriMojProfil() {
    if (trenutniKorisnik) {
        prethodniEkran = 'lokacijePrikaz'; // Vraćamo se na glavni ekran
        otvoriProfil(trenutniKorisnik.id);
    }
}

async function prikaziEditProfila() {
    prethodniEkran = 'glavniDio'; // Vraćamo se na profil
    const ja = sviKorisnici.find(u => u.id === trenutniKorisnik.id);
    if (!ja) return;
    
    document.getElementById("editIme").value = ja.ime || '';
    document.getElementById("editOpis").value = ja.opis || '';
    document.getElementById("editInstagram").value = ja.instagram || '';
    document.getElementById("editTiktok").value = ja.tiktok || '';
    document.getElementById("previewEditSlike").src = ja.slika || 'default_profile.png';
    odabranaEditSlika = null;
    swap('glavniDio', 'editProfil');
}

async function sacuvajProfil() {
    const sacuvajBtn = document.getElementById('sacuvajProfilBtn');
    sacuvajBtn.disabled = true;
    
    const updateData = {
        username: document.getElementById("editIme").value.trim(),
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
        if (response.ok) {
            await globalRefreshUI();
            zatvoriEkran('editProfil', 'glavniDio');
            setTimeout(() => otvoriProfil(trenutniKorisnik.id), 350); // Osvježi prikaz profila
        } else {
            alert("Greška pri spremanju.");
        }
    } catch(e) {
        alert("Greška pri spremanju.");
    } finally {
        sacuvajBtn.disabled = false;
    }
}

async function azurirajMojuAktivnost(loggingOut = false) {
    if (!trenutniKorisnik) return;
    try { await authenticatedFetch(`/api/users/${trenutniKorisnik.id}/activity`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ loggingOut }) }); }
    catch (error) { console.error("Greška pri ažuriranju aktivnosti:", error); }
}

function formatirajStatus(isoTimestamp) {
    if (!isoTimestamp) return { text: "Offline", online: false };
    const diffSekunde = Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 1e3);
    if (diffSekunde < 30) return { text: "Online", online: true };
    const diffMinute = Math.round(diffSekunde / 60);
    if (diffMinute < 60) return { text: `viđen/a prije ${diffMinute} min`, online: false };
    const diffSati = Math.round(diffMinute / 60);
    return { text: `viđen/a prije ${diffSati} h`, online: false };
}

function dohvatiLokaciju(callback) {
    navigator.geolocation.getCurrentPosition(pos => {
        mojPoz = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        if(callback) callback();
    }, () => {
        alert("Pristup lokaciji je potreban.");
        if(callback) callback();
    });
}

function distKM(p1, p2) {
    if (!p1 || !p2) return "?";
    const R = 6371, dLat = (p2.lat - p1.lat) * Math.PI / 180, dLon = (p2.lon - p1.lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

function pokaziObjavu() {
    prethodniEkran = 'lokacijePrikaz';
    swap(prethodniEkran, "glavniDio");
    document.querySelector("#glavniDio h2").innerText = "Objavi pijanku";
    document.getElementById("objavaForma").style.display = "flex";
    document.getElementById("profilKorisnika").style.display = "none";
    document.getElementById("opisPijanke").value = "";
    document.querySelector('#glavniDio .back-button').style.display = 'none';
    document.querySelector('#glavniDio .close-btn').style.display = 'flex';
}

async function objaviPijanku() {
    const opis = document.getElementById("opisPijanke").value.trim();
    if (!opis) return alert("Opiši pijanku!");
    if (!mojPoz) return dohvatiLokaciju(objaviPijanku);
    
    const objaviBtn = document.querySelector('#objavaForma button');
    objaviBtn.disabled = true;
    
    try {
        const response = await authenticatedFetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ opis, lat: mojPoz.lat, lon: mojPoz.lon })
        });
        if (response.ok) {
            await dohvatiSvePijanke();
            zatvoriEkran("glavniDio", "lokacijePrikaz");
            prikaziPijankePregled();
        } else {
            alert("Greška pri objavi.");
        }
    } catch (e) {
        alert("Greška pri objavi.");
    } finally {
        objaviBtn.disabled = false;
    }
}

async function obrisiPijanku(pijankaId, event) {
    if (event) event.stopPropagation();
    if (confirm("Obrisati objavu?")) {
        await authenticatedFetch(`/api/posts?postId=${pijankaId}`, { method: 'DELETE' });
        await dohvatiSvePijanke();
        prikaziPijankePregled();
    }
}

function prikaziPijankePregled() {
    const div = document.getElementById("pijankePregled");
    if (!div) return;
    div.innerHTML = "";
    if (svePijanke.length === 0) {
        div.innerHTML = '<p style="text-align:center; padding-top: 40px;">Trenutno nitko ne pije. Budi prvi!</p>';
        return;
    }
    svePijanke.forEach(pijanka => {
        const autor = sviKorisnici.find(u => u.id === pijanka.korisnikId);
        if (!autor) return;
        const status = formatirajStatus(autor.lastActive);
        div.innerHTML += `
            <div class="pijanka" onclick="otvoriProfil('${autor.id}')">
                <div class="pijanka-header">
                    <img src="${autor.slika || 'default_profile.png'}" alt="Profilna slika" class="pijanka-profilna-slika">
                    <div class="pijanka-info">
                        <div>
                            <span class="status-dot ${status.online ? "online" : "offline"}"></span>
                            <strong>${autor.ime}</strong>
                        </div>
                        <p class="status-text">pije ${distKM(mojPoz, pijanka)}km od tebe</p>
                    </div>
                    ${(trenutniKorisnik && autor.id === trenutniKorisnik.id) ? `<button class="delete-btn" onclick="obrisiPijanku('${pijanka.id}', event)">🗑️</button>` : ""}
                </div>
                <div class="pijanka-opis"> <p>${pijanka.opis}</p> </div>
            </div>`;
    });
}

// ** IZMJENA: Funkcija sada drugačije prikazuje tvoj i tuđi profil **
async function otvoriProfil(korisnikId) {
    if (!korisnikId) return;
    prethodniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz';
    const korisnik = sviKorisnici.find(u => u.id === korisnikId);
    if (!korisnik) { alert("Korisnik nije pronađen."); return; }
    
    swap(prethodniEkran, "glavniDio");
    
    const profilKorisnikaDiv = document.getElementById("profilKorisnika");
    document.querySelector('#glavniDio h2').innerText = "Profil";
    document.getElementById("objavaForma").style.display = "none";
    profilKorisnikaDiv.style.display = "flex";
    
    let actionButtonsHTML = '';
    // Provjeravamo je li profil koji otvaramo profil trenutno ulogiranog korisnika
    if (trenutniKorisnik && korisnik.id === trenutniKorisnik.id) {
        // Ako jest, prikaži gumbe za uređivanje i odjavu
        actionButtonsHTML = `
            <div class="profile-actions">
                <button class="btn-primary" onclick="prikaziEditProfila()">Uredi Profil</button>
                <button class="btn-secondary" onclick="odjaviSe()">Odjava</button>
            </div>
        `;
    } else {
        // Ako nije, prikaži gumb za slanje poruke
        actionButtonsHTML = `<button onclick="pokreniPrivatniChat('${korisnik.id}', 'glavniDio')">💬 Pošalji poruku</button>`;
    }

    profilKorisnikaDiv.innerHTML = `
        <img src="${korisnik.slika || 'default_profile.png'}" class="profilna-slika-velika">
        <h2 style="padding-top:0; margin-bottom: 5px;">${korisnik.ime}</h2>
        <div class="drustvene-mreze">${prikaziMreze(korisnik)}</div>
        <p class="profil-opis">${korisnik.opis || "Nema opisa."}</p>
        ${actionButtonsHTML}
    `;

    document.querySelector('#glavniDio .back-button').style.display = 'flex';
    document.querySelector('#glavniDio .close-btn').style.display = 'none';
}


function prikaziMreze(p) {
    let s = "";
    if (p.instagram) s += `<a href="https://instagram.com/${p.instagram}" target="_blank"><img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" class="mreza-ikonica" alt="instagram"></a>`;
    if (p.tiktok) s += `<a href="https://cdn-icons-png.flaticon.com/512/3046/3046122.png" class="mreza-ikonica" alt="tiktok"></a>`;
    return s || '';
}

function azurirajNotifikacije() {
    const badge = document.getElementById("inboxNotificationBadge");
    if (!badge || !trenutniKorisnik) return;
    
    let neprocitane = 0;
    for (const chatKey in privatnePoruke) {
        if (chatKey.includes(trenutniKorisnik.id)) {
            neprocitane += privatnePoruke[chatKey].filter(msg => !msg.isRead && msg.autorId !== trenutniKorisnik.id).length;
        }
    }
    badge.style.display = neprocitane > 0 ? 'block' : 'none';
}

// ** IZMJENA: Funkcija sada pamti odakle je pozvana **
async function prikaziInbox(saEkrana) {
    prethodniInboxEkran = saEkrana; // Postavi prethodni ekran
    swap(saEkrana, 'inboxPrikaz');
    const div = document.getElementById("listaChatova");
    div.innerHTML = "";
    const chatKeys = Object.keys(privatnePoruke).filter(key => key.includes(trenutniKorisnik.id));
    if (chatKeys.length === 0) {
        div.innerHTML = '<p style="text-align:center;color:#888;">Nemaš još nijednu poruku.</p>';
        return;
    }
    chatKeys.sort((a, b) => new Date(privatnePoruke[b].slice(-1)[0]?.time) - new Date(privatnePoruke[a].slice(-1)[0]?.time))
    .forEach(chatKey => {
        const partnerId = chatKey.split("-").find(id => id !== trenutniKorisnik.id);
        const partner = sviKorisnici.find(u => u.id == partnerId);
        if (!partner) return;
        const neprocitane = privatnePoruke[chatKey].some(m => !m.isRead && m.autorId == partner.id);
        div.innerHTML += `
            <div class="chat-item" onclick="pokreniPrivatniChat('${partner.id}', 'inboxPrikaz')">
                <img src="${partner.slika || 'default_profile.png'}" alt="profilna">
                <div class="chat-item-info">
                    <strong>${partner.ime}</strong>
                    <p class="status-text">${formatirajStatus(partner.lastActive).text}</p>
                </div>
                ${neprocitane ? '<span class="notification-badge-chat"></span>' : ""}
            </div>`;
    });
}

async function pokreniPrivatniChat(partnerId, saEkrana) {
    prethodniEkran = saEkrana;
    trenutniChatPartnerId = partnerId;
    swap(saEkrana, "privatniChat");
    // ... ostatak funkcije ostaje isti
}

// Ostatak funkcija (dohvatiSve*, itd.) ostaju iste...
async function dohvatiSveKorisnike() { try { const r = await authenticatedFetch('/api/users'); if(r.ok) sviKorisnici = await r.json(); } catch(e) {console.error(e)} }
async function dohvatiSvePijanke() { try { const r = await authenticatedFetch('/api/posts'); if(r.ok) svePijanke = await r.json(); } catch(e) {console.error(e)} }
async function dohvatiSvePoruke() { if(!localStorage.getItem("token")) return; try { const r = await authenticatedFetch('/api/messages'); if(r.ok) privatnePoruke = await r.json(); } catch(e) {console.error(e)} }