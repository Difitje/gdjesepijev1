// public/script.js

// Uklanjamo sve localStorage varijable jer ćemo ih dohvatiti sa servera
let trenutniKorisnik = null;
let sviKorisnici = []; // Sada će se dohvaćati sa servera
let svePijanke = [];   // Sada će se dohvaćati sa servera
let privatnePoruke = {}; // Sada će se dohvaćati sa servera

let trenutniChatPartnerId = null;
let mojPoz = null; // Ovo ostaje na frontendu
let activityInterval = null;
let chatStatusInterval = null;
let globalDataRefreshInterval = null;
let odabranaSlika = null; // Ovo ostaje na frontendu za upload
let odabranaEditSlika = null; // Ovo ostaje na frontendu za upload

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


window.onload = async function() { // Dodaj 'async' ovdje!
    // Stari nacin, mozda je i dalje u localStorage, pa ga ocisti
    localStorage.removeItem("loggedInUserId");

    const token = localStorage.getItem("token"); // Sad koristimo token
    if (token) {
        try {
            const response = await authenticatedFetch('/api/auth/me'); // Provjera tokena i dohvaćanje korisnika
            if (response.ok) {
                const data = await response.json();
                trenutniKorisnik = data.user;
                await dohvatiSveKorisnike();
                await dohvatiSvePijanke();
                await dohvatiSvePoruke();
                pokreniAplikaciju();
            } else {
                // Token nije validan ili je istekao
                localStorage.removeItem("token");
                document.getElementById("intro").style.display = "block";
            }
        } catch (error) {
            console.error("Greška pri provjeri tokena:", error);
            localStorage.removeItem("token");
            document.getElementById("intro").style.display = "block";
        }
    } else {
        document.getElementById("intro").style.display = "block";
    }
};

// Uklonjene funkcije ucitajPodatke() i sacuvajPodatke() jer se više ne koristi localStorage

function swap(hideId, showId) {
    if (document.getElementById(hideId)) document.getElementById(hideId).style.display = "none";
    if (document.getElementById(showId)) document.getElementById(showId).style.display = "block";
}
function proveriPrihvatanje() {
    const checkbox = document.getElementById('prihvatamPravila');
    const button = document.getElementById('nastaviBtn');
    button.disabled = !checkbox.checked;
}
function nazadNaListu() { swap("glavniDio", "lokacijePrikaz"); }

async function globalRefreshUI() { // Dodaj async!
    if (!trenutniKorisnik) return;
    await dohvatiSveKorisnike();
    await dohvatiSvePijanke();
    await dohvatiSvePoruke();

    if (document.getElementById("lokacijePrikaz").style.display === "block") prikaziPijankePregled();
    if (document.getElementById("inboxPrikaz").style.display === "block") prikaziInbox();
    if (document.getElementById("privatniChat").style.display === "block" && trenutniChatPartnerId) prikaziPrivatniLog(); // Osvjezi log ako je chat otvoren
    azurirajNotifikacije();
}

document.getElementById("slikaUpload").addEventListener("change", function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            odabranaSlika = e.target.result;
            document.getElementById("previewSlike").src = odabranaSlika;
            document.getElementById("previewSlike").style.display = "block";
        };
        reader.readAsDataURL(file);
    }
});
document.getElementById("editSlikaUpload").addEventListener("change", function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            odabranaEditSlika = e.target.result;
            document.getElementById("previewEditSlike").src = odabranaEditSlika;
            document.getElementById("previewEditSlike").style.display = "block";
        };
        reader.readAsDataURL(file);
    }
});

// REGISTRACIJA
async function registruj() {
    const ime = document.getElementById("ime").value.trim();
    const sifra = document.getElementById("sifra").value.trim();
    const instagram = document.getElementById("instagram").value.trim();
    const tiktok = document.getElementById("tiktok").value.trim();
    const opis = document.getElementById("opis").value.trim();

    if (!ime || !sifra || !odabranaSlika) {
        return alert("Molimo popunite korisničko ime, lozinku i odaberite sliku!");
    }

    console.log("Pokušavam registrirati korisnika:", ime); // LOG 1

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: ime,
                password: sifra,
                slika: odabranaSlika,
                instagram,
                tiktok,
                opis
            })
        });

        const data = await response.json();

        if (response.ok) { // Ako je registracija uspješna
            alert(data.message);
            console.log("Registracija uspješna, pokušavam automatsku prijavu..."); // LOG 2
            await ulogujSe(ime, sifra); // Pokušaj automatske prijave
            console.log("Automatska prijava pokušana."); // LOG 3
        } else {
            alert("Greška pri registraciji: " + data.message);
            console.error("Greška s registracijskim API-jem:", data); // LOG 4
        }
    } catch (error) {
        console.error("Greška kod registracije (catch blok):", error); // LOG 5
        alert("Došlo je do greške pri registraciji.");
    }
}

// PRIJAVA
async function ulogujSe(usernameFromRegister = null, passwordFromRegister = null) {
    const ime = usernameFromRegister || document.getElementById("loginIme").value.trim();
    const sifra = passwordFromRegister || document.getElementById("loginSifra").value.trim();

    if (!ime || !sifra) {
        return alert("Unesite korisničko ime i lozinku!");
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: ime, password: sifra })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem("token", data.token); // Spremi token!
            trenutniKorisnik = data.user; // Server treba vratiti i korisnika
            await dohvatiSveKorisnike();
            await dohvatiSvePijanke();
            await dohvatiSvePoruke();
            pokreniAplikaciju();
        } else {
            alert("Greška pri prijavi: " + data.message);
        }
    } catch (error) {
        console.error("Greška kod prijave:", error);
        alert("Došlo je do greške pri prijavi.");
    }
}

async function odjaviSe() {
    [activityInterval, chatStatusInterval, globalDataRefreshInterval].forEach(i => i && clearInterval(i));
    if (trenutniKorisnik && trenutniKorisnik.id) { // Pazi da postoji korisnik i ID prije poziva
        await azurirajMojuAktivnost(true); // Šalje serveru da smo offline
    }
    localStorage.removeItem("token");
    trenutniKorisnik = null;
    odabranaSlika = null;
    odabranaEditSlika = null;
    ["loginIme", "loginSifra", "ime", "sifra", "instagram", "tiktok", "opis", "editIme", "editOpis", "editInstagram", "editTiktok"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    // Sakrij sve ekrane i prikaži intro
    ["lokacijePrikaz", "inboxPrikaz", "glavniDio", "privatniChat", "editProfil", "odabir", "pravilaEkran"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
    swap("", "intro");
}

function pokreniAplikaciju() {
    ["login", "registracija", "odabir", "intro", "pravilaEkran"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
    const lokacijePrikazEl = document.getElementById("lokacijePrikaz");
    if (lokacijePrikazEl) lokacijePrikazEl.style.display = "block";

    [activityInterval, globalDataRefreshInterval].forEach(i => i && clearInterval(i));
    activityInterval = setInterval(azurirajMojuAktivnost, 15e3); // Svakih 15 sekundi
    globalDataRefreshInterval = setInterval(globalRefreshUI, 3e3); // Svake 3 sekunde za refresh
    azurirajMojuAktivnost(); // Pošalji odmah

    // Initial load, then periodically refresh
    dohvatiLokaciju(() => {
        prikaziPijankePregled();
        azurirajNotifikacije();
    });
}

async function prikaziEditProfila() { // Dodaj async!
    // Dohvati najnovije podatke o profilu sa servera
    try {
        const response = await authenticatedFetch(`/api/users/${trenutniKorisnik.id}`);
        if (response.ok) {
            const user = await response.json();
            document.getElementById("editIme").value = user.ime;
            document.getElementById("editOpis").value = user.opis;
            document.getElementById("editInstagram").value = user.instagram;
            document.getElementById("editTiktok").value = user.tiktok;
            document.getElementById("previewEditSlike").src = user.slika;
            odabranaEditSlika = null; // Resetiraj odabranu sliku za uređivanje
            swap("lokacijePrikaz", "editProfil");
        } else {
            const errorData = await response.json();
            alert("Greška pri dohvaćanju profila: " + errorData.message);
        }
    } catch (error) {
        console.error("Greška mreže pri dohvaćanju profila:", error);
        alert("Došlo je do greške pri dohvaćanju profila.");
    }
}

async function sacuvajProfil() { // Dodaj async!
    const novoIme = document.getElementById("editIme").value.trim();
    const noviOpis = document.getElementById("editOpis").value.trim();
    const noviInstagram = document.getElementById("editInstagram").value.trim();
    const noviTiktok = document.getElementById("editTiktok").value.trim();

    if (!novoIme) return alert("Ime ne može biti prazno!");

    const updateData = {
        username: novoIme,
        opis: noviOpis,
        instagram: noviInstagram,
        tiktok: noviTiktok
    };
    if (odabranaEditSlika) {
        updateData.slika = odabranaEditSlika;
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
            // Ažuriraj lokalnog trenutnog korisnika s novim podacima
            trenutniKorisnik.ime = novoIme;
            trenutniKorisnik.opis = noviOpis;
            trenutniKorisnik.instagram = noviInstagram;
            trenutniKorisnik.tiktok = noviTiktok;
            if (odabranaEditSlika) {
                trenutniKorisnik.slika = odabranaEditSlika;
            }
            await globalRefreshUI(); // Osvježi sve podatke
            swap("editProfil", "lokacijePrikaz");
        } else {
            alert("Greška pri spremanju profila: " + data.message);
        }
    } catch (error) {
        console.error("Greška kod spremanja profila:", error);
        alert("Došlo je do greške pri spremanju profila.");
    }
}

async function azurirajMojuAktivnost(loggingOut = false) { // Dodaj async!
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

function formatirajStatus(isoTimestamp) { // Očekuje ISO string
    if (!isoTimestamp) return { text: "Offline", online: false };
    const timestamp = new Date(isoTimestamp).getTime();
    const diffSekunde = Math.round((Date.now() - timestamp) / 1e3);
    if (diffSekunde < 30) return { text: "Online", online: true };
    if (diffSekunde < 60) return { text: "viđen/a prije minutu", online: false };
    const diffMinute = Math.round(diffSekunde / 60);
    if (diffMinute < 60) return { text: `viđen/a prije ${diffMinute} min`, online: false };
    const diffSati = Math.round(diffMinute / 60);
    if (diffSati < 24) return { text: `viđen/a prije ${diffSati} h`, online: false };
    const diffDani = Math.round(diffSati / 24);
    return { text: `viđen/a prije ${diffDani} dana`, online: false };
}
function dohvatiLokaciju(callback) {
    if (!navigator.geolocation) {
        console.warn("Geolokacija nije podržana u ovom pregledniku.");
        return callback && callback();
    }
    navigator.geolocation.getCurrentPosition(pos => {
        mojPoz = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        callback && callback();
    }, (error) => {
        console.error("Greška pri dohvaćanju geolokacije:", error);
        alert("Nismo dobili geolokaciju. Molimo odobrite pristup lokaciji. Bez lokacije nećete moći objavljivati pijanke.");
        callback && callback();
    });
}
function distKM(p1, p2) {
    if (!p1 || !p2 || p1.lat === undefined || p1.lon === undefined || p2.lat === undefined || p2.lon === undefined) return "?"; // Provjera null/undefined
    const R = 6371,
        dLat = (p2.lat - p1.lat) * Math.PI / 180,
        dLon = (p2.lon - p1.lon) * Math.PI / 180,
        a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}
function pokaziObjavu() {
    swap("lokacijePrikaz", "glavniDio");
    document.getElementById("glavniNaslov").innerText = "Objavi pijanku";
    document.getElementById("profilKorisnika").style.display = "none";
    document.getElementById("objavaForma").style.display = "block";
    document.getElementById("opisPijanke").value = "";
}

async function objaviPijanku() { // Dodaj async!
    const opis = document.getElementById("opisPijanke").value.trim();
    if (!opis) return alert("Molimo popunite opis pijanke!");
    if (!mojPoz || mojPoz.lat === null || mojPoz.lon === null) {
        return dohvatiLokaciju(() => objaviPijanku()); // Ponovno pokušaj ako je lokacija prazna
    }

    try {
        const response = await authenticatedFetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                opis,
                lat: mojPoz.lat,
                lon: mojPoz.lon
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            await dohvatiSvePijanke(); // Osvježi listu pijanki nakon objave
            swap("glavniDio", "lokacijePrikaz");
            prikaziPijankePregled();
        } else {
            alert("Greška pri objavi pijanke: " + data.message);
        }
    } catch (error) {
        console.error("Greška kod objave pijanke:", error);
        alert("Došlo je do greške pri objavi pijanke.");
    }
}

async function obrisiPijanku(pijankaId, event) { // Dodaj async!
    event.stopPropagation();
    if (confirm("Jeste li sigurni da želite obrisati ovu objavu?")) {
        try {
            const response = await authenticatedFetch(`/api/posts?postId=${pijankaId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message);
                await dohvatiSvePijanke(); // Osvježi listu pijanki
                prikaziPijankePregled();
            } else {
                alert("Greška pri brisanju objave: " + data.message);
            }
        } catch (error) {
            console.error("Greška kod brisanja objave:", error);
            alert("Došlo je do greške pri brisanju objave.");
        }
    }
}

function prikaziPijankePregled() {
    const div = document.getElementById("pijankePregled");
    if (!div) return; // Provjeri postoji li element
    div.innerHTML = "";
    if (svePijanke.length === 0) {
        div.innerHTML = '<p style="text-align:center;">Trenutno nitko ne pije. Budi prvi!</p>';
        return;
    }
    svePijanke.forEach(pijanka => {
        // Pronađi autora iz globalno dohvaćenih svihKorisnika
        const autor = sviKorisnici.find(u => u.id === pijanka.korisnikId);
        if (!autor) return; // Preskoči ako autor nije pronađen (možda obrisan)

        const status = formatirajStatus(autor.lastActive);
        div.innerHTML += `<div class="pijanka">
            <div class="pijanka-info" onclick="otvoriProfil('${autor.id}')">
                <div>
                    <span class="status-dot ${status.online?"online":"offline"}"></span>
                    <strong>${autor.ime}</strong>
                </div>
                <p class="status-text" style="padding-left:17px;">pije ${distKM(mojPoz, pijanka)} km</p>
            </div>
            ${autor.id === trenutniKorisnik.id ? `<button class="delete-btn" onclick="obrisiPijanku('${pijanka._id}', event)">🗑️</button>` : ""}
        </div>`;
    });
}

async function otvoriProfil(korisnikId) { // Dodaj async!
    // Dohvati najnovije podatke o korisniku sa servera
    try {
        const response = await authenticatedFetch(`/api/users/${korisnikId}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Korisnik nije pronađen.");
        }
        const korisnik = await response.json();

        swap("lokacijePrikaz", "glavniDio");
        document.getElementById("glavniNaslov").innerText = "Profil korisnika";
        document.getElementById("objavaForma").style.display = "none";
        const divProfil = document.getElementById("profilKorisnika");
        divProfil.style.display = "block";
        divProfil.innerHTML = `<div style="text-align:center; cursor:default; display:block;">
            <img src="${korisnik.slika}" class="profilna-slika" style="margin-bottom:15px;">
            <h2 style="display:block; vertical-align:middle;">${korisnik.ime}</h2>
            <p style="font-size:15px; font-style:italic; color:#ccc;">${korisnik.opis || "Nema opisa."}</p>
            <div style="margin:20px 0;">${prikaziMreze(korisnik)}</div>
            ${korisnik.id !== trenutniKorisnik.id ? `<button onclick="pokreniPrivatniChat('${korisnik.id}', 'glavniDio')">💬 Pošalji poruku</button>` : '<em style="color:#888;">Ovo je tvoj profil.</em>'}
        </div>`;
    } catch (error) {
        console.error("Greška pri otvaranju profila:", error);
        alert("Došlo je do greške pri otvaranju profila: " + error.message);
    }
}

function prikaziMreze(p) {
    let s = "";
    if (p.instagram) s += `<a href="https://instagram.com/${p.instagram}" target="_blank"><img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" class="mreza-ikonica" alt="instagram"></a>`;
    if (p.tiktok) s += `<a href="https://tiktok.com/@${p.tiktok}" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/3046/3046122.png" class="mreza-ikonica" alt="tiktok"></a>`;
    return s || '<span style="font-size:13px; color:#888;">Nema društvenih mreža.</span>';
}

function azurirajNotifikacije() {
    let neprocitane = 0;
    const badgeContainer = document.getElementById("notifikacijaPoruka");
    if (!badgeContainer) return; // Provjeri postoji li element

    badgeContainer.innerHTML = "";
    for (const chatKey in privatnePoruke) {
        if (chatKey.includes(trenutniKorisnik.id)) {
            neprocitane += privatnePoruke[chatKey].filter(msg => !msg.isRead && msg.autorId !== trenutniKorisnik.id).length;
        }
    }
    if (neprocitane > 0) {
        badgeContainer.innerHTML = `<span class="notification-badge"></span>`;
    }
}

async function prikaziInbox() { // Dodaj async!
    const div = document.getElementById("listaChatova");
    if (!div) return; // Provjeri postoji li element

    div.innerHTML = "";
    const chatKeys = Object.keys(privatnePoruke).filter(key => key.includes(trenutniKorisnik.id));

    if (chatKeys.length === 0) {
        div.innerHTML = '<p style="text-align:center;color:#888;">Nemaš još nijednu poruku.</p>';
        return;
    }

    chatKeys.sort((a, b) => {
        const lastMsgA = privatnePoruke[a][privatnePoruke[a].length - 1];
        const lastMsgB = privatnePoruke[b][privatnePoruke[b].length - 1];
        if (!lastMsgA || !lastMsgB) return 0; // Handle empty chat arrays gracefully
        return new Date(lastMsgB.time) - new Date(lastMsgA.time);
    }).forEach(chatKey => {
        const ids = chatKey.split("-");
        const partnerId = ids[0] == trenutniKorisnik.id ? ids[1] : ids[0];
        const partner = sviKorisnici.find(u => u.id == partnerId);
        if (!partner) return; // Preskoči ako partner nije pronađen

        const neprocitane = privatnePoruke[chatKey].some(m => !m.isRead && m.autorId == partner.id);
        const status = formatirajStatus(partner.lastActive);
        div.innerHTML += `<div class="chat-item">
            <img src="${partner.slika}" alt="profilna">
            <div class="chat-item-info" onclick="pokreniPrivatniChat('${partner.id}', 'inboxPrikaz')">
                <div>
                    <span class="status-dot ${status.online?"online":"offline"}"></span>
                    <strong>${partner.ime}</strong>
                </div>
                <p class="status-text">${status.online?"Online":status.text}</p>
            </div>
            ${neprocitane?'<span class="notification-badge" style="position:relative; top:0; right:0;"></span>':""}
        </div>`;
    });
    swap("lokacijePrikaz", "inboxPrikaz");
}

let prethodniEkran = "lokacijePrikaz"; // Globalna varijabla

async function pokreniPrivatniChat(partnerId, saEkrana) { // Dodaj async!
    prethodniEkran = saEkrana;
    trenutniChatPartnerId = partnerId;
    const primalac = sviKorisnici.find(u => u.id === partnerId);
    if (!primalac) return;

    document.getElementById("chatSaKorisnikom").innerText = primalac.ime;

    // Označi poruke kao pročitane na serveru
    const chatKey = [trenutniKorisnik.id, trenutniChatPartnerId].sort().join("-");
    try {
        await authenticatedFetch('/api/messages', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatKey: chatKey })
        });
        await dohvatiSvePoruke(); // Osvježi lokalne poruke nakon markiranja kao pročitanih
        azurirajNotifikacije();
    } catch (error) {
        console.error("Greška pri označavanju poruka kao pročitanih:", error);
    }


    const azurirajStatusSagovornika = () => {
        const svezPartner = sviKorisnici.find(u => u.id === partnerId);
        if (svezPartner) {
            const status = formatirajStatus(svezPartner.lastActive);
            document.getElementById("chatPartnerStatus").innerText = status.text;
        }
    };
    if (chatStatusInterval) clearInterval(chatStatusInterval);
    chatStatusInterval = setInterval(azurirajStatusSagovornika, 5e3);
    azurirajStatusSagovornika(); // Odmah prikaži status
    swap(prethodniEkran, "privatniChat");
    prikaziPrivatniLog();
}

async function posaljiPrivatno() { // Dodaj async!
    const tekst = document.getElementById("privatniInput").value.trim();
    if (!tekst) return;

    try {
        const response = await authenticatedFetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                receiverId: trenutniChatPartnerId,
                content: tekst
            })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById("privatniInput").value = "";
            await dohvatiSvePoruke(); // Osvježi sve poruke
            prikaziPrivatniLog();
            globalRefreshUI(); // Za ažuriranje notifikacija i ostalih UI elemenata
        } else {
            alert("Greška pri slanju poruke: " + data.message);
        }
    } catch (error) {
        console.error("Greška kod slanja poruke:", error);
        alert("Došlo je do greške pri slanju poruke.");
    }
}

function prikaziPrivatniLog() {
    const chatKey = [trenutniKorisnik.id, trenutniChatPartnerId].sort().join("-");
    const log = privatnePoruke[chatKey] || [];
    const div = document.getElementById("privatniChatLog");
    if (!div) return; // Provjeri postoji li element

    div.innerHTML = log.map(msg => `<p class="${msg.autorId === trenutniKorisnik.id ? "moja-poruka" : "tudja-poruka"}"><span>${msg.tekst}</span></p>`).join("");
    div.scrollTop = div.scrollHeight;
}

function zatvoriPrivatni() {
    if (chatStatusInterval) clearInterval(chatStatusInterval);
    trenutniChatPartnerId = null;
    const privatniInputEl = document.getElementById("privatniInput");
    if (privatniInputEl) privatniInputEl.value = "";
    swap("privatniChat", prethodniEkran);
    if (prethodniEkran === "inboxPrikaz") prikaziInbox();
}

// --- NOVE FUNKCIJE ZA DOHVAĆANJE PODATAKA SA SERVERA ---
async function dohvatiSveKorisnike() {
    try {
        const response = await authenticatedFetch('/api/users');
        if (response.ok) {
            sviKorisnici = await response.json();
        } else {
            console.error("Greška pri dohvaćanju korisnika:", await response.text());
            sviKorisnici = [];
        }
    } catch (error) {
        console.error("Greška mreže pri dohvaćanju korisnika:", error);
        sviKorisnici = [];
    }
}

async function dohvatiSvePijanke() {
    try {
        const response = await authenticatedFetch('/api/posts');
        if (response.ok) {
            svePijanke = await response.json();
        } else {
            console.error("Greška pri dohvaćanju pijanki:", await response.text());
            svePijanke = [];
        }
    } catch (error) {
        console.error("Greška mreže pri dohvaćanju pijanki:", error);
        svePijanke = [];
    }
}

async function dohvatiSvePoruke() {
    try {
        const token = localStorage.getItem("token");
        if (!token) {
             privatnePoruke = {};
             return;
        }

        const response = await authenticatedFetch('/api/messages');
        if (response.ok) {
            privatnePoruke = await response.json();
        } else {
            console.error("Greška pri dohvaćanju poruka:", await response.text());
            privatnePoruke = {};
        }
    } catch (error) {
        console.error("Greška mreže pri dohvaćanju poruka:", error);
        privatnePoruke = {};
    }
}