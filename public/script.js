// public/script.js - VERZIJA S REDIZAJNIRANIM CHATOM

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
let inboxReturnPath = "lokacijePrikaz"; 

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
        img.onerror = () => {
            console.error("Greška pri učitavanju slike za kompresiju.");
            resolve(base64Image);
        };
    });
}

window.addEventListener('DOMContentLoaded', async function() {
    // ... (postojeći kod odavde do kraja inicijalizacije)
    localStorage.removeItem("loggedInUserId");
    const token = localStorage.getItem("token");
    const splashScreen = document.getElementById('splashScreen');

    document.querySelectorAll('.container').forEach(el => {
        if (el.id !== 'splashScreen') {
            el.style.display = 'none';
            el.classList.remove('active-screen', 'fade-out-screen');
        }
    });

    let appInitializedSuccessfully = false;
    if (token) {
        try {
            const response = await authenticatedFetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
                trenutniKorisnik = data.user;
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

    if (splashScreen) {
        setTimeout(() => {
            splashScreen.style.animation = 'fadeOutSplash 0.5s ease-out forwards';
            setTimeout(() => {
                splashScreen.style.display = 'none';
                splashScreen.remove();
                if (appInitializedSuccessfully) {
                    pokreniAplikaciju();
                } else {
                    const introEl = document.getElementById('intro');
                    if (introEl) {
                        introEl.style.display = 'flex';
                        setTimeout(() => introEl.classList.add('active-screen'), 10);
                    }
                }
            }, 500);
        }, 2000);
    }
});

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

function zatvoriEkran(trenutniEkranId, povratniEkranId) {
    swap(trenutniEkranId, povratniEkranId);
    if (trenutniEkranId === 'privatniChat') {
        if (chatStatusInterval) clearInterval(chatStatusInterval);
        trenutniChatPartnerId = null;
        const privatniInput = document.getElementById("privatniInput");
        privatniInput.value = "";
        privatniInput.style.height = 'auto'; // Resetiraj visinu
        document.getElementById('posaljiPrivatnoBtn').classList.remove('enabled');
    }
    azurirajNotifikacije();
}

function proveriPrihvatanje() {
    const checkbox = document.getElementById('prihvatamPravila');
    const button = document.getElementById('nastaviBtn');
    if (button && checkbox) button.disabled = !checkbox.checked;
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
    }
    if (document.getElementById("inboxPrikaz")?.classList.contains('active-screen')) {
        otvoriInbox(inboxReturnPath); 
    }
    if (document.getElementById("privatniChat")?.classList.contains('active-screen') && trenutniChatPartnerId) {
        prikaziPrivatniLog();
    }
    azurirajNotifikacije();
}

document.addEventListener('DOMContentLoaded', () => {
    // Postojeći listeneri
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

    const editSlikaUploadEl = document.getElementById("editSlikaUpload");
    if (editSlikaUploadEl) {
        editSlikaUploadEl.addEventListener("change", handleEditSlikaUploadChange);
    }
    
    // NOVA LOGIKA ZA CHAT INPUT
    const privatniInput = document.getElementById('privatniInput');
    const posaljiBtn = document.getElementById('posaljiPrivatnoBtn');
    
    if (privatniInput && posaljiBtn) {
        privatniInput.addEventListener('input', () => {
            // Automatsko mijenjanje visine
            privatniInput.style.height = 'auto';
            privatniInput.style.height = `${privatniInput.scrollHeight}px`;

            // Prikaz/skrivanje gumba za slanje
            if (privatniInput.value.trim().length > 0) {
                posaljiBtn.disabled = false;
                posaljiBtn.classList.add('enabled');
            } else {
                posaljiBtn.disabled = true;
                posaljiBtn.classList.remove('enabled');
            }
        });
    }
});

function handleEditSlikaUploadChange() {
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
}

async function registruj() {
    const ime = document.getElementById("ime").value.trim();
    const sifra = document.getElementById("sifra").value.trim();
    const instagram = document.getElementById("instagram").value.trim();
    const tiktok = document.getElementById("tiktok").value.trim();
    const opis = document.getElementById("opis").value.trim();
    const registrujBtn = document.getElementById('registracijaSubmitBtn');

    if (!ime || !sifra || !odabranaSlika) {
        return alert("Molimo popunite korisničko ime, lozinku i odaberite sliku!");
    }

    registrujBtn.disabled = true;
    registrujBtn.textContent = 'Registracija u tijeku...';

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
        registrujBtn.disabled = false;
        registrujBtn.textContent = 'Spremi';
    }
}

async function ulogujSe(usernameFromRegister = null, passwordFromRegister = null) {
    const ime = usernameFromRegister || document.getElementById("loginIme").value.trim();
    const sifra = passwordFromRegister || document.getElementById("loginSifra").value.trim();
    const loginBtn = document.getElementById('loginSubmitBtn');

    if (!ime || !sifra) {
        return alert("Unesite korisničko ime i lozinku!");
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Prijava u tijeku...';

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
            alert("Greška pri prijavi: " + data.message);
        }
    } catch (error) {
        alert("Došlo je do greške pri prijavi.");
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Prijavi se';
    }
}

async function odjaviSe() {
    [activityInterval, chatStatusInterval, globalDataRefreshInterval].forEach(i => i && clearInterval(i));
    if (trenutniKorisnik && trenutniKorisnik.id) {
        await azurirajMojuAktivnost(true);
    }
    localStorage.removeItem("token");
    trenutniKorisnik = null;
    odabranaSlika = null;
    odabranaEditSlika = null;
    ["loginIme", "loginSifra", "ime", "sifra", "instagram", "tiktok", "opis", "editIme", "editOpis", "editInstagram", "editTiktok", "opisPijanke", "privatniInput"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    swap(document.querySelector('.container.active-screen').id, 'intro');
}

function pokreniAplikaciju() {
    swap(document.querySelector('.container.active-screen')?.id, 'lokacijePrikaz');
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
        swap('lokacijePrikaz', 'odabir');
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
    document.getElementById("previewEditSlike").src = user.slika || 'default_profile.png';
    document.getElementById("previewEditSlike").style.display = "block";
    odabranaEditSlika = null;
    swap('glavniDio', 'editProfil');
}

async function sacuvajProfil() {
    const novoIme = document.getElementById("editIme").value.trim();
    const noviOpis = document.getElementById("editOpis").value.trim();
    const noviInstagram = document.getElementById("editInstagram").value.trim();
    const noviTiktok = document.getElementById("editTiktok").value.trim();
    const sacuvajBtn = document.getElementById('sacuvajProfilBtn');

    if (!novoIme) return alert("Ime ne može biti prazno!");
    sacuvajBtn.disabled = true;
    sacuvajBtn.textContent = 'Spremam promjene...';
    let finalSlika = null;
    if (odabranaEditSlika) {
        finalSlika = await compressImage(odabranaEditSlika);
    }
    const updateData = { username: novoIme, opis: noviOpis, instagram: noviInstagram, tiktok: noviTiktok };
    if (finalSlika) {
        updateData.slika = finalSlika;
    }
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
            zatvoriEkran("editProfil", 'glavniDio');
        } else {
            alert("Greška pri spremanju profila: " + data.message);
        }
    } catch (error) {
        alert("Došlo je do greške pri spremanja profila.");
    } finally {
        sacuvajBtn.disabled = false;
        sacuvajBtn.textContent = 'Spremi promjene';
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
    if (diffSekunde < 60) return { text: "viđen/a prije minutu", online: false };
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
    prethodniEkran = 'lokacijePrikaz';
    swap(prethodniEkran, "glavniDio");
    document.querySelector('#glavniDio h2').innerText = "Objavi pijanku";
    document.getElementById("objavaForma").style.display = "flex";
    document.getElementById("profilKorisnika").style.display = "none";
    document.getElementById("opisPijanke").value = "";
    document.querySelector('#glavniDio .back-button').style.display = 'none';
    document.querySelector('#glavniDio .close-btn').style.display = 'flex';
}

async function objaviPijanku() {
    const opis = document.getElementById("opisPijanke").value.trim();
    if (!opis) return alert("Molimo popunite opis pijanke!");
    if (!mojPoz) return dohvatiLokaciju(() => objaviPijanku());

    const objaviBtn = document.querySelector('#objavaForma button');
    objaviBtn.disabled = true;
    objaviBtn.textContent = 'Objavljujem...';
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
            zatvoriEkran("glavniDio", "lokacijePrikaz");
            prikaziPijankePregled();
        } else {
            alert("Greška pri objavi pijanke: " + data.message);
        }
    } catch (error) {
        alert("Došlo je do greške pri objavi pijanke.");
    } finally {
        objaviBtn.disabled = false;
        objaviBtn.textContent = 'Objavi';
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
    div.innerHTML = "";
    if (svePijanke.length === 0) {
        div.innerHTML = '<p style="text-align:center;">Trenutno nitko ne pije. Budi prvi!</p>';
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

async function otvoriProfil(korisnikId) {
    if (!korisnikId) return;
    prethodniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz';
    const korisnik = sviKorisnici.find(u => u.id === korisnikId);
    if (!korisnik) return;
    
    swap(prethodniEkran, "glavniDio");
    
    const profilKorisnikaDiv = document.getElementById("profilKorisnika");
    document.getElementById("objavaForma").style.display = "none";
    profilKorisnikaDiv.style.display = "flex";
    
    let actionButtons = '';
    if (trenutniKorisnik && korisnik.id === trenutniKorisnik.id) {
        document.querySelector('#glavniDio h2').innerText = "Moj profil";
        actionButtons = `
            <button onclick="prikaziEditProfila()">Uredi profil</button>
            <button class="btn-danger" onclick="odjaviSe()">Odjavi se</button>
        `;
    } else {
        document.querySelector('#glavniDio h2').innerText = "Profil korisnika";
        actionButtons = `<button onclick="pokreniPrivatniChat('${korisnik.id}', 'glavniDio')">💬 Pošalji poruku</button>`;
    }

    profilKorisnikaDiv.innerHTML = `
        <img src="${korisnik.slika || 'default_profile.png'}" class="profilna-slika-velika">
        <h2 style="padding-top:0; margin-bottom: 5px;">${korisnik.ime || 'Nepoznat korisnik'}</h2>
        <p class="profil-opis">${korisnik.opis || "Nema opisa."}</p>
        <div class="drustvene-mreze">${prikaziMreze(korisnik)}</div>
        <div class="profil-actions">${actionButtons}</div>
    `;

    document.querySelector('#glavniDio .back-button').style.display = 'flex';
    document.querySelector('#glavniDio .close-btn').style.display = 'none';
}


function prikaziMreze(p) {
    let s = "";
    if (p.instagram) s += `<a href="https://instagram.com/${p.instagram}" target="_blank"><img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" class="mreza-ikonica" alt="instagram"></a>`;
    if (p.tiktok) s += `<a href="https://cdn-icons-png.flaticon.com/512/3046/3046122.png" class="mreza-ikonica" alt="tiktok"></a>`;
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

function otvoriInbox(fromScreen) {
    inboxReturnPath = fromScreen;
    prethodniEkran = fromScreen;
    swap(fromScreen, 'inboxPrikaz'); 

    const div = document.getElementById("listaChatova");
    div.innerHTML = "";
    const chatKeys = (trenutniKorisnik && trenutniKorisnik.id) ? Object.keys(privatnePoruke).filter(key => key.includes(trenutniKorisnik.id)) : [];
    
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
        const status = formatirajStatus(partner.lastActive);
        div.innerHTML += `
            <div class="chat-item" onclick="pokreniPrivatniChat('${partner.id}', 'inboxPrikaz')">
                <img src="${partner.slika || 'default_profile.png'}" alt="profilna">
                <div class="chat-item-info">
                    <span class="status-dot ${status.online ? "online" : "offline"}"></span>
                    <div class="chat-item-info-text">
                        <strong>${partner.ime}</strong>
                        <p class="status-text">${status.online ? "Online" : status.text}</p>
                    </div>
                </div>
                ${neprocitane ? '<span class="notification-badge-chat"></span>' : ""}
            </div>`;
    });
}

async function pokreniPrivatniChat(partnerId, saEkrana) {
    prethodniEkran = saEkrana;
    trenutniChatPartnerId = partnerId;
    const primalac = sviKorisnici.find(u => u.id === partnerId);
    if (!primalac) return;
    document.getElementById("chatSaKorisnikom").innerText = primalac.ime;
    swap(saEkrana, "privatniChat");
    const chatKey = [trenutniKorisnik.id, trenutniChatPartnerId].sort().join("-");
    try {
        await authenticatedFetch('/api/messages', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatKey })
        });
        await dohvatiSvePoruke();
        azurirajNotifikacije();
    } catch (error) { console.error("Greška kod označavanja poruka kao pročitanih:", error); }
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

// AŽURIRANA FUNKCIJA - resetira visinu polja i gumb nakon slanja
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
        
        privatniInput.value = ""; // Očisti polje
        privatniInput.style.height = 'auto'; // Resetiraj visinu
        posaljiBtn.classList.remove('enabled'); // Sakrij gumb
        
        await dohvatiSvePoruke();
        prikaziPrivatniLog();
    } catch (error) {
        alert("Došlo je do greške pri slanju poruke.");
    } finally {
        // Omogućavanje gumba se sada vrši preko 'input' eventa
    }
}

function prikaziPrivatniLog() {
    if (!trenutniKorisnik || !trenutniChatPartnerId) return;
    const chatKey = [trenutniKorisnik.id, trenutniChatPartnerId].sort().join("-");
    const log = privatnePoruke[chatKey] || [];
    const div = document.getElementById("privatniChatLog");
    div.innerHTML = log.map(msg => `<p class="${msg.autorId === trenutniKorisnik.id ? "moja-poruka" : "tudja-poruka"}"><span>${msg.tekst}</span></p>`).join("");
    div.scrollTop = div.scrollHeight;
}

async function dohvatiSveKorisnike() {
    try {
        const response = await authenticatedFetch('/api/users');
        if (response.ok) sviKorisnici = await response.json();
    } catch (error) { console.error("Greška mreže pri dohvaćanju korisnika:", error); }
}

async function dohvatiSvePijanke() {
    try {
        const response = await authenticatedFetch('/api/posts');
        if (response.ok) svePijanke = await response.json();
    } catch (error) { console.error("Greška mreže pri dohvaćanju pijanki:", error); }
}

async function dohvatiSvePoruke() {
    if (!localStorage.getItem("token")) return;
    try {
        const response = await authenticatedFetch('/api/messages');
        if (response.ok) privatnePoruke = await response.json();
    } catch (error) { console.error("Greška mreže pri dohvaćanju poruka:", error); }
}