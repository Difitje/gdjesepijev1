// public/script.js - KORIGIRANA VERZIJA

// Globalne varijale
let trenutniKorisnik = null;
let sviKorisnici = [];
let svePijanke = [];
let privatnePoruke = {}; // Strukturirano kao {chatKey: [messages]}

let trenutniChatPartnerId = null;
let mojPoz = null; // Geolokacija ostaje lokalno na frontendu
let activityInterval = null;
let chatStatusInterval = null;
let globalDataRefreshInterval = null;
let odabranaSlika = null; // Za upload profilne slike pri registraciji (Base64)
let odabranaEditSlika = null; // Za upload profilne slike pri uređivanje (Base64)
let prethodniEkran = "lokacijePrikaz"; // Dodana globalna varijabla za prethodni ekran

// --- POMOĆNA FUNKCIJA ZA FETCH POZIVE SA AUTORIZACIJOM ---
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

// --- FUNKCIJA ZA KOMPRESIJU SLIKE PRIJE UPLOADA ---
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

// --- GLAVNI DOGAĐAJ ZA UČITAVANJE APLIKACIJE ---
window.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM učitan, pokrećem inicijalizaciju...");

    // --- PRVO, POVEŽIMO SVE EVENT LISTENERE ---
    // Ovo osigurava da su gumbi uvijek povezani, bez obzira na stanje prijave.

    // Novi header/footer gumbi
    const profilIcon = document.getElementById('profilIcon');
    const porukeIcon = document.getElementById('porukeIcon');
    const novaObjavaBtn = document.getElementById('novaObjavaBtn');

    if (profilIcon) {
        profilIcon.addEventListener('click', () => {
            const trenutniAktivniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz';
            prethodniEkran = trenutniAktivniEkran;
            swap(trenutniAktivniEkran, 'profilMeni');
        });
    }

    if (porukeIcon) {
        porukeIcon.addEventListener('click', () => {
            prikaziInbox();
        });
    }

    if (novaObjavaBtn) {
        novaObjavaBtn.addEventListener('click', () => {
            pokaziObjavu();
        });
    }

    // Listeneri za upload slika
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
    
    console.log("Event listeneri su postavljeni.");

    // --- SADA, KREĆEMO S LOGIKOM SPLASH SCREENA I AUTENTIKACIJE ---
    localStorage.removeItem("loggedInUserId");
    const token = localStorage.getItem("token");
    const splashScreen = document.getElementById('splashScreen');

    document.querySelectorAll('.container').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active-screen', 'fade-out-screen');
    });

    let appInitializedSuccessfully = false;

    if (token) {
        try {
            console.log("Pronađen token, provjeravam...");
            const response = await authenticatedFetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
                trenutniKorisnik = data.user;
                console.log("Korisnik uspješno autentificiran:", trenutniKorisnik.ime);
                await Promise.all([dohvatiSveKorisnike(), dohvatiSvePijanke(), dohvatiSvePoruke()]);
                appInitializedSuccessfully = true;
            } else {
                console.warn("Token nevalidan ili istekao.");
                localStorage.removeItem("token");
            }
        } catch (error) {
            console.error("Greška pri provjeri tokena (vjerojatno server nije pokrenut):", error);
            localStorage.removeItem("token");
        }
    }

    // Logika za skrivanje splash screena
    if (splashScreen) {
        console.log("Prikazujem splash screen na 2 sekunde.");
        setTimeout(() => {
            splashScreen.style.animation = 'fadeOutSplash 0.5s ease-out forwards';
            splashScreen.addEventListener('animationend', () => {
                splashScreen.style.display = 'none';
                
                if (appInitializedSuccessfully) {
                    console.log("Pokrećem aplikaciju...");
                    pokreniAplikaciju();
                } else {
                    console.log("Prikazujem intro ekran...");
                    const introEl = document.getElementById('intro');
                    if (introEl) {
                        swap(null, 'intro'); // Koristimo swap za prikaz intro ekrana
                    }
                }
            }, { once: true });
        }, 2000); // Čekaj 2 sekunde
    } else {
        // Fallback ako nema splash screena
        if (appInitializedSuccessfully) {
            pokreniAplikaciju();
        } else {
            swap(null, 'intro');
        }
    }
});


// --- FUNKCIJE ZA PREBACIVANJE EKRANA (UI LOGIKA) ---
function swap(hideId, showId) {
    const hideElement = document.getElementById(hideId);
    const showElement = document.getElementById(showId);

    if (!showElement) {
        console.error("Element za prikaz nije pronađen:", showId);
        return;
    }

    if (hideElement) {
        hideElement.classList.remove('active-screen');
        hideElement.style.display = 'none'; // Odmah sakrij stari
    }

    showElement.style.display = 'flex'; // Pokaži novi
    showElement.classList.add('active-screen');
}


function zatvoriEkran(trenutniEkranId, povratniEkranId) {
    swap(trenutniEkranId, povratniEkranId);
    if (trenutniEkranId === 'privatniChat') {
        if (chatStatusInterval) clearInterval(chatStatusInterval);
        trenutniChatPartnerId = null;
        document.getElementById("privatniInput").value = "";
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
        prikaziInbox();
    }
    if (document.getElementById("privatniChat")?.classList.contains('active-screen') && trenutniChatPartnerId) {
        prikaziPrivatniLog();
    }
    azurirajNotifikacije();
}


function handleEditSlikaUploadChange() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            odabranaEditSlika = e.target.result;
            const previewElement = document.getElementById("previewEditSlike");
            if (previewElement) {
                previewElement.src = odabranaEditSlika;
            }
        };
        reader.readAsDataURL(file);
    }
}


// --- FUNKCIJE ZA AUTENTIFIKACIJU (REGISTRACIJA, PRIJAVA, ODJAVA) ---

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
    registrujBtn.textContent = 'Registracija...';

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
            alert("Greška: " + data.message);
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
    loginBtn.textContent = 'Prijava...';

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
        loginBtn.disabled = false;
        loginBtn.textContent = 'Prijavi se';
    }
}

async function odjaviSe() {
    // SAKRIJ HEADER I FOOTER
    document.getElementById('noviHeader').style.display = 'none';
    document.getElementById('noviFooter').style.display = 'none';

    [activityInterval, chatStatusInterval, globalDataRefreshInterval].forEach(i => i && clearInterval(i));
    if (trenutniKorisnik && trenutniKorisnik.id) {
        await azurirajMojuAktivnost(true);
    }
    localStorage.removeItem("token");
    trenutniKorisnik = null;
    document.querySelectorAll('input, textarea').forEach(el => el.value = "");
    
    // Nađi koji je ekran trenutno aktivan da ga možeš sakriti
    const aktivniEkran = document.querySelector('.container.active-screen');
    if (aktivniEkran) {
        swap(aktivniEkran.id, 'intro');
    } else {
        // Ako nijedan nije aktivan, samo pokaži intro
        swap(null, 'intro');
    }
}


// --- LOGIKA POKRETANJA APLIKACIJE NAKON PRIJAVE/REGISTRACIJE ---
function pokreniAplikaciju() {
    // PRIKAŽI HEADER I FOOTER
    document.getElementById('noviHeader').style.display = 'flex';
    document.getElementById('noviFooter').style.display = 'flex';

    const trenutniAktivniEkran = document.querySelector('.container.active-screen')?.id;
    swap(trenutniAktivniEkran, 'lokacijePrikaz');

    [activityInterval, globalDataRefreshInterval].forEach(i => i && clearInterval(i));
    activityInterval = setInterval(azurirajMojuAktivnost, 15e3);
    globalDataRefreshInterval = setInterval(globalRefreshUI, 30e3);

    azurirajMojuAktivnost();
    dohvatiLokaciju(() => {
        prikaziPijankePregled();
        azurirajNotifikacije();
    });
}

// --- LOGIKA PROFILA I UREĐIVANJA PROFILA ---

function pokaziPostavkeEkran() { // Ova funkcija se više ne poziva iz UI-a ali neka ostane
    prethodniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz';
    swap(prethodniEkran, 'profilMeni'); // Preusmjerava na novi meni
    azurirajNotifikacije();
}


async function prikaziEditProfila() {
    if (!trenutniKorisnik || !trenutniKorisnik.id) return;
    
    const trenutniAktivniEkran = document.querySelector('.container.active-screen')?.id;
    prethodniEkran = trenutniAktivniEkran;

    swap(prethodniEkran, 'editProfil');
    const editProfilScreen = document.getElementById("editProfil");
    editProfilScreen.innerHTML = `
        <div class="top-nav-buttons">
            <button class="back-button left-aligned" onclick="zatvoriEkran('editProfil', 'profilMeni')">←</button>
        </div>
        <h2>Uredi profil</h2>
        <p style="text-align:center;">Učitavam profil...</p>
    `;

    try {
        const response = await authenticatedFetch(`/api/users/${trenutniKorisnik.id}`);
        if (!response.ok) throw new Error("Profil nije dohvaćen");

        const user = await response.json();
        editProfilScreen.innerHTML = `
            <div class="top-nav-buttons">
                <button class="back-button left-aligned" onclick="zatvoriEkran('editProfil', 'profilMeni')">←</button>
            </div>
            <h2>Uredi profil</h2>
            <div style="text-align:center;"><img id="previewEditSlike" class="profilna-slika" /></div>
            <input id="editIme" placeholder="Korisničko ime" />
            <textarea id="editOpis" placeholder="O meni..." rows="3"></textarea>
            <input id="editInstagram" placeholder="Instagram korisničko ime" />
            <input id="editTiktok" placeholder="TikTok korisničko ime" />
            <label style="font-size:14px; display:block; margin-bottom:5px;">Promijeni profilnu sliku:</label>
            <input type="file" id="editSlikaUpload" accept="image/*" />
            <button id="sacuvajProfilBtn" onclick="sacuvajProfil()">Spremi promjene</button>
        `;
        document.getElementById("editIme").value = user.ime || '';
        document.getElementById("editOpis").value = user.opis || '';
        document.getElementById("editInstagram").value = user.instagram || '';
        document.getElementById("editTiktok").value = user.tiktok || '';
        document.getElementById("previewEditSlike").src = user.slika || 'default_profile.png';
        odabranaEditSlika = null;
        document.getElementById("editSlikaUpload").addEventListener("change", handleEditSlikaUploadChange);

    } catch (error) {
        alert("Greška pri dohvaćanju profila.");
        zatvoriEkran('editProfil', 'profilMeni'); 
    }
}

async function sacuvajProfil() {
    const novoIme = document.getElementById("editIme").value.trim();
    if (!novoIme) return alert("Ime ne može biti prazno!");
    const sacuvajBtn = document.getElementById('sacuvajProfilBtn');
    sacuvajBtn.disabled = true;
    sacuvajBtn.textContent = 'Spremam...';

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
            alert(data.message);
            await globalRefreshUI(); // Osvježi podatke
            zatvoriEkran("editProfil", 'profilMeni');
        } else {
            alert("Greška: " + data.message);
        }
    } catch (error) {
        alert("Došlo je do greške pri spremanju.");
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
    } catch (error) {
        console.error("Greška pri ažuriranju aktivnosti:", error);
    }
}

function formatirajStatus(isoTimestamp) {
    if (!isoTimestamp) return { text: "Offline", online: false };
    const diffSekunde = Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 1e3);
    if (diffSekunde < 30) return { text: "Online", online: true };
    if (diffSekunde < 60) return { text: "prije minutu", online: false };
    const diffMinute = Math.round(diffSekunde / 60);
    if (diffMinute < 60) return { text: `prije ${diffMinute} min`, online: false };
    const diffSati = Math.round(diffMinute / 60);
    if (diffSati < 24) return { text: `prije ${diffSati} h`, online: false };
    return { text: `prije ${Math.round(diffSati / 24)} dana`, online: false };
}

// --- GEOLOKACIJA ---
function dohvatiLokaciju(callback) {
    if (!navigator.geolocation) {
        return callback && callback();
    }
    navigator.geolocation.getCurrentPosition(pos => {
        mojPoz = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        callback && callback();
    }, (error) => {
        alert("Pristup lokaciji je potreban za korištenje aplikacije.");
        mojPoz = null;
        callback && callback();
    }, { enableHighAccuracy: true });
}

function distKM(p1, p2) {
    if (!p1 || !p2) return "?";
    const R = 6371, dLat = (p2.lat - p1.lat) * Math.PI / 180, dLon = (p2.lon - p1.lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

// --- OBJAVE (PIJANKE) LOGIKA ---
function pokaziObjavu() {
    prethodniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz';
    swap(prethodniEkran, "glavniDio");
    
    document.querySelector('#glavniDio h2').innerText = "Objavi pijanku";
    document.getElementById("objavaForma").style.display = "block";
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
            await dohvatiSvePijanke();
            zatvoriEkran("glavniDio", "lokacijePrikaz");
            prikaziPijankePregled();
        } else {
            alert("Greška: " + data.message);
        }
    } catch (error) {
        alert("Došlo je do greške pri objavi.");
    } finally {
        objaviBtn.disabled = false;
        objaviBtn.textContent = 'Objavi';
    }
}

async function obrisiPijanku(pijankaId, event) {
    event.stopPropagation();
    if (confirm("Jeste li sigurni da želite obrisati ovu objavu?")) {
        try {
            const response = await authenticatedFetch(`/api/posts?postId=${pijankaId}`, { method: 'DELETE' });
            const data = await response.json();
            if (response.ok) {
                await dohvatiSvePijanke();
                prikaziPijankePregled();
            } else {
                alert("Greška: " + data.message);
            }
        } catch (error) {
            alert("Došlo je do greške pri brisanju.");
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
            <div class="pijanka">
                <div class="pijanka-header" onclick="otvoriProfil('${autor.id}')">
                    <img src="${autor.slika || 'default_profile.png'}" alt="Profilna" class="pijanka-profilna-slika">
                    <div class="pijanka-info">
                        <div>
                            <span class="status-dot ${status.online?"online":"offline"}"></span>
                            <strong>${autor.ime}</strong>
                        </div>
                        <p class="status-text">pije ${distKM(mojPoz, pijanka)}km od tebe</p>
                    </div>
                    ${trenutniKorisnik && autor.id === trenutniKorisnik.id ? `<button class="delete-btn" onclick="obrisiPijanku('${pijanka.id}', event)">🗑️</button>` : ""}
                </div>
                <div class="pijanka-opis"><p>${pijanka.opis}</p></div>
            </div>`;
    });
}

async function otvoriProfil(korisnikId) {
    prethodniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz'; 
    swap(prethodniEkran, "glavniDio");

    const profilKorisnika = document.getElementById("profilKorisnika");
    document.querySelector('#glavniDio h2').innerText = "Profil korisnika";
    document.getElementById("objavaForma").style.display = 'none';
    profilKorisnika.style.display = 'block';
    profilKorisnika.innerHTML = `<p style="text-align:center;">Učitavam profil...</p>`;
    document.querySelector('#glavniDio .back-button').style.display = 'flex';
    document.querySelector('#glavniDio .close-btn').style.display = 'none';

    try {
        const response = await authenticatedFetch(`/api/users/${korisnikId}`);
        if (!response.ok) throw new Error("Korisnik nije pronađen");

        const korisnik = await response.json();
        profilKorisnika.innerHTML = `
            <div style="text-align:center;">
                <img src="${korisnik.slika || 'default_profile.png'}" class="profilna-slika" style="width:90px; height:90px; margin-bottom:15px;">
                <h2>${korisnik.ime}</h2>
                <p style="color:#ccc; padding:0 15px;">${korisnik.opis || "Nema opisa."}</p>
                <div style="margin:20px 0;">${prikaziMreze(korisnik)}</div>
                ${trenutniKorisnik && korisnik.id !== trenutniKorisnik.id ? `<button onclick="pokreniPrivatniChat('${korisnik.id}', 'glavniDio')">💬 Pošalji poruku</button>` : '<em style="color:#888;">Ovo je tvoj profil.</em>'}
            </div>`;
    } catch (error) {
        alert("Greška: " + error.message);
        zatvoriEkran('glavniDio', prethodniEkran);
    }
}

function prikaziMreze(p) {
    let s = "";
    if (p.instagram) s += `<a href="https://instagram.com/${p.instagram}" target="_blank"><img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" style="width:24px; margin:0 8px;" alt="instagram"></a>`;
    if (p.tiktok) s += `<a href="https://tiktok.com/@${p.tiktok}" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/3046/3046122.png" style="width:24px; margin:0 8px;" alt="tiktok"></a>`;
    return s || '<span style="font-size:13px; color:#888;">Nema društvenih mreža.</span>';
}

// --- LOGIKA INBOXA I PORUKA ---
function azurirajNotifikacije() {
    let neprocitane = 0;
    const badgeHeader = document.getElementById("notifikacijaPorukaHeader");
    
    if (trenutniKorisnik && trenutniKorisnik.id) {
        for (const chatKey in privatnePoruke) {
            if (chatKey.includes(trenutniKorisnik.id)) {
                neprocitane += privatnePoruke[chatKey].filter(msg => !msg.isRead && msg.autorId !== trenutniKorisnik.id).length;
            }
        }
    }
    
    if (badgeHeader) {
        if (neprocitane > 0) {
            badgeHeader.innerText = `${neprocitane > 9 ? '9+' : neprocitane}`;
            badgeHeader.style.display = 'flex';
        } else {
            badgeHeader.style.display = 'none';
        }
    }
}


async function prikaziInbox() {
    prethodniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz';
    swap(prethodniEkran, "inboxPrikaz");
    const div = document.getElementById("listaChatova");
    if (!div) return;

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
                    <div>
                        <span class="status-dot ${status.online?"online":"offline"}"></span>
                        <strong>${partner.ime}</strong>
                    </div>
                    <p class="status-text">${status.text}</p>
                </div>
                ${neprocitane?'<span class="notification-badge" style="position:static; height:10px; width:10px;"></span>':""}
            </div>`;
    });
}

async function pokreniPrivatniChat(partnerId, saEkrana) {
    prethodniEkran = saEkrana;
    trenutniChatPartnerId = partnerId;
    const primalac = sviKorisnici.find(u => u.id === partnerId);
    if (!primalac) return alert("Korisnik nije pronađen.");

    document.getElementById("chatSaKorisnikom").innerText = primalac.ime;

    const chatKey = [trenutniKorisnik.id, trenutniChatPartnerId].sort().join("-");
    await authenticatedFetch('/api/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatKey })
    });
    await dohvatiSvePoruke();
    azurirajNotifikacije();

    const azurirajStatusSagovornika = () => {
        const svezPartner = sviKorisnici.find(u => u.id === partnerId);
        if(svezPartner) document.getElementById("chatPartnerStatus").innerText = formatirajStatus(svezPartner.lastActive).text;
    };
    if (chatStatusInterval) clearInterval(chatStatusInterval);
    chatStatusInterval = setInterval(azurirajStatusSagovornika, 5e3);
    azurirajStatusSagovornika();

    swap(saEkrana, "privatniChat"); 
    prikaziPrivatniLog();
}

async function posaljiPrivatno() {
    const tekst = document.getElementById("privatniInput").value.trim();
    if (!tekst) return;
    const posaljiBtn = document.getElementById('posaljiPrivatnoBtn');
    posaljiBtn.disabled = true;

    try {
        await authenticatedFetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiverId: trenutniChatPartnerId, content: tekst })
        });
        document.getElementById("privatniInput").value = "";
        await dohvatiSvePoruke();
        prikaziPrivatniLog();
    } catch (error) {
        alert("Greška pri slanju poruke.");
    } finally {
        posaljiBtn.disabled = false;
    }
}

function prikaziPrivatniLog() {
    if (!trenutniKorisnik) return;
    const chatKey = [trenutniKorisnik.id, trenutniChatPartnerId].sort().join("-");
    const log = privatnePoruke[chatKey] || [];
    const div = document.getElementById("privatniChatLog");
    div.innerHTML = log.map(msg => `<p class="${msg.autorId === trenutniKorisnik.id ? "moja-poruka" : "tudja-poruka"}"><span>${msg.tekst}</span></p>`).join("");
    div.scrollTop = div.scrollHeight;
}


// --- FUNKCIJE ZA DOHVAĆANJE PODATAKA SA SERVERA ---
async function dohvatiSveKorisnike() {
    try {
        const response = await authenticatedFetch('/api/users');
        if (response.ok) sviKorisnici = await response.json();
    } catch (e) { console.error("Greška dohvaćanja korisnika", e); }
}

async function dohvatiSvePijanke() {
    try {
        const response = await authenticatedFetch('/api/posts');
        if (response.ok) svePijanke = await response.json();
    } catch (e) { console.error("Greška dohvaćanja pijanki", e); }
}

async function dohvatiSvePoruke() {
    try {
        if (!localStorage.getItem("token")) return;
        const response = await authenticatedFetch('/api/messages');
        if (response.ok) privatnePoruke = await response.json();
    } catch (e) { console.error("Greška dohvaćanja poruka", e); }
}