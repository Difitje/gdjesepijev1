// public/script.js

// Globalne varijable (sada se podaci pune sa servera, a ne iz localStorage)
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
let odabranaEditSlika = null; // Za upload profilne slike pri uređivanju (Base64)

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

// public/script.js

// ... (ostatak koda) ...

// --- POČETNO UČITAVANJE APLIKACIJE ---
window.onload = async function() {
    localStorage.removeItem("loggedInUserId"); // Čišćenje starog, lokalnog ID-a

    const token = localStorage.getItem("token"); // Pokušaj dohvatiti token
    console.log("window.onload: Pokušavam dohvatiti token:", token ? "Token pronađen" : "Nema tokena");

    if (token) {
        try {
            // Provjeri token na serveru
            const response = await authenticatedFetch('/api/auth/me');
            console.log("window.onload: Odgovor od /api/auth/me (status):", response.status);

            if (response.ok) {
                const data = await response.json();
                trenutniKorisnik = data.user;
                console.log("window.onload: Korisnik uspješno autentificiran:", trenutniKorisnik.ime);

                // Provjeri da su svi podaci dohvaćeni prije pokretanja aplikacije
                await Promise.all([
                    dohvatiSveKorisnike(),
                    dohvatiSvePijanke(),
                    dohvatiSvePoruke()
                ]);
                console.log("window.onload: Svi početni podaci dohvaćeni.");
                pokreniAplikaciju();
            } else {
                console.warn("window.onload: Token nevalidan ili istekao, odjavljujem korisnika (status:", response.status, ").");
                localStorage.removeItem("token");
                swap("", "intro");
            }
        } catch (error) {
            console.error("window.onload: Greška pri provjeri tokena ili mreži (catch blok):", error);
            localStorage.removeItem("token");
            swap("", "intro");
        }
    } else {
        console.log("window.onload: Nema tokena, prikazujem intro ekran.");
        swap("", "intro");
    }
};

// --- FUNKCIJE ZA PREBACIVANJE EKRANA (UI LOGIKA) ---
function swap(hideId, showId) {
    const hideElement = document.getElementById(hideId);
    const showElement = document.getElementById(showId);
    if (hideElement) hideElement.style.display = "none";
    if (showElement) showElement.style.display = "block";
}

function proveriPrihvatanje() {
    const checkbox = document.getElementById('prihvatamPravila');
    const button = document.getElementById('nastaviBtn');
    if (button && checkbox) button.disabled = !checkbox.checked;
}

function nazadNaListu() {
    swap("glavniDio", "lokacijePrikaz");
}

async function globalRefreshUI() {
    if (!trenutniKorisnik) return; // Nemoj osvježavati ako korisnik nije prijavljen
    await dohvatiSveKorisnike();
    await dohvatiSvePijanke();
    await dohvatiSvePoruke();

    // Ažuriraj samo ako je relevantan ekran prikazan
    if (document.getElementById("lokacijePrikaz")?.style.display === "block") prikaziPijankePregled();
    if (document.getElementById("inboxPrikaz")?.style.display === "block") prikaziInbox();
    // Ažuriraj log privatnog chata samo ako je otvoren
    if (document.getElementById("privatniChat")?.style.display === "block" && trenutniChatPartnerId) prikaziPrivatniLog();
    azurirajNotifikacije();
}

// --- FUNKCIJE ZA UPLOAD SLIKA (Lokalna obrada Base64) ---
document.getElementById("slikaUpload")?.addEventListener("change", function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            odabranaSlika = e.target.result;
            const previewElement = document.getElementById("previewSlike");
            if (previewElement) {
                previewElement.src = odabranaSlika;
                previewElement.style.display = "block";
            }
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById("editSlikaUpload")?.addEventListener("change", function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            odabranaEditSlika = e.target.result;
            const previewElement = document.getElementById("previewEditSlike");
            if (previewElement) {
                previewElement.src = odabranaEditSlika;
                previewElement.style.display = "block";
            }
        };
        reader.readAsDataURL(file);
    }
});

// --- FUNKCIJE ZA AUTENTIFIKACIJU (REGISTRACIJA, PRIJAVA, ODJAVA) ---

async function registruj() {
    const imeInput = document.getElementById("ime");
    const sifraInput = document.getElementById("sifra");
    const instagramInput = document.getElementById("instagram");
    const tiktokInput = document.getElementById("tiktok");
    const opisInput = document.getElementById("opis");

    const ime = imeInput ? imeInput.value.trim() : '';
    const sifra = sifraInput ? sifraInput.value.trim() : '';
    const instagram = instagramInput ? instagramInput.value.trim() : '';
    const tiktok = tiktokInput ? tiktokInput.value.trim() : '';
    const opis = opisInput ? opisInput.value.trim() : '';


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

async function ulogujSe(usernameFromRegister = null, passwordFromRegister = null) {
    const loginImeInput = document.getElementById("loginIme");
    const loginSifraInput = document.getElementById("loginSifra");

    const ime = usernameFromRegister || (loginImeInput ? loginImeInput.value.trim() : '');
    const sifra = passwordFromRegister || (loginSifraInput ? loginSifraInput.value.trim() : '');

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
            localStorage.setItem("token", data.token); // Spremi JWT token!
            trenutniKorisnik = data.user; // Server vraća objekt korisnika
            await dohvatiSveKorisnike(); // Osvježi lokalne liste sa servera
            await dohvatiSvePijanke();
            await dohvatiSvePoruke();
            pokreniAplikaciju(); // Pokreni glavni dio aplikacije (prebaci ekrane)
        } else {
            alert("Greška pri prijavi: " + data.message);
        }
    } catch (error) {
        console.error("Greška kod prijave:", error);
        alert("Došlo je do greške pri prijavi.");
    }
}

async function odjaviSe() {
    // Zaustavi intervale osvježavanja aktivnosti i globalnih podataka
    [activityInterval, chatStatusInterval, globalDataRefreshInterval].forEach(i => i && clearInterval(i));

    // Ažuriraj status korisnika na serveru da je offline
    if (trenutniKorisnik && trenutniKorisnik.id) {
        await azurirajMojuAktivnost(true);
    }

    localStorage.removeItem("token"); // Ukloni JWT token iz localStorage
    trenutniKorisnik = null; // Resetiraj trenutnog korisnika
    odabranaSlika = null;
    odabranaEditSlika = null;

    // Očisti sva input polja na ekranima
    ["loginIme", "loginSifra", "ime", "sifra", "instagram", "tiktok", "opis", "editIme", "editOpis", "editInstagram", "editTiktok"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // Sakrij sve ekrane i prikaži početni intro ekran
    ["lokacijePrikaz", "inboxPrikaz", "glavniDio", "privatniChat", "editProfil", "odabir", "pravilaEkran"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
    swap("", "intro");
}

// --- LOGIKA POKRETANJA APLIKACIJE NAKON PRIJAVE/REGISTRACIJE ---
// --- LOGIKA POKRETANJA APLIKACIJE NAKON PRIJAVE/REGISTRACIJE ---
function pokreniAplikaciju() {
    console.log("pokreniAplikaciju: Pokrećem glavni dio aplikacije."); // LOG

    // Sakrij sve ekrane za prijavu/registraciju
    ["login", "registracija", "odabir", "intro", "pravilaEkran"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    // Prikaži glavni ekran s objavama
    const lokacijePrikazEl = document.getElementById("lokacijePrikaz");
    if (lokacijePrikazEl) lokacijePrikazEl.style.display = "block";

    // Poništi prethodne intervale i postavi nove za osvježavanje
    [activityInterval, globalDataRefreshInterval].forEach(i => i && clearInterval(i));
    activityInterval = setInterval(azurirajMojuAktivnost, 15e3); // Ažuriraj status aktivnosti svakih 15 sekundi
    globalDataRefreshInterval = setInterval(globalRefreshUI, 15e3); // Osvježavaj UI svakih 10 sekundi (dohvati podatke)

    azurirajMojuAktivnost(); // Odmah pošalji status aktivnosti
    // Dohvati geolokaciju i prikaži objave/notifikacije
    dohvatiLokaciju(() => {
        prikaziPijankePregled();
        azurirajNotifikacije();
    });
    console.log("pokreniAplikaciju: Aplikacija pokrenuta, intervali postavljeni."); // LOG
}

// --- LOGIKA PROFILA I UREĐIVANJA PROFILA ---
async function prikaziEditProfila() {
    // Dohvati najnovije podatke o profilu sa servera
    if (!trenutniKorisnik || !trenutniKorisnik.id) return; // Osiguraj da je korisnik prijavljen
    try {
        const response = await authenticatedFetch(`/api/users/${trenutniKorisnik.id}`);
        if (response.ok) {
            const user = await response.json();
            const editImeEl = document.getElementById("editIme");
            const editOpisEl = document.getElementById("editOpis");
            const editInstagramEl = document.getElementById("editInstagram");
            const editTiktokEl = document.getElementById("editTiktok");
            const previewEditSlikeEl = document.getElementById("previewEditSlike");

            if (editImeEl) editImeEl.value = user.ime || '';
            if (editOpisEl) editOpisEl.value = user.opis || '';
            if (editInstagramEl) editInstagramEl.value = user.instagram || '';
            if (editTiktokEl) editTiktokEl.value = user.tiktok || '';
            if (previewEditSlikeEl) previewEditSlikeEl.src = user.slika || '';
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

async function sacuvajProfil() {
    const novoImeEl = document.getElementById("editIme");
    const noviOpisEl = document.getElementById("editOpis");
    const noviInstagramEl = document.getElementById("editInstagram");
    const noviTiktokEl = document.getElementById("editTiktok");

    const novoIme = novoImeEl ? novoImeEl.value.trim() : '';
    const noviOpis = noviOpisEl ? noviOpisEl.value.trim() : '';
    const noviInstagram = noviInstagramEl ? noviInstagramEl.value.trim() : '';
    const noviTiktok = noviTiktokEl ? noviTiktokEl.value.trim() : '';

    if (!novoIme) return alert("Ime ne može biti prazno!");
    if (!trenutniKorisnik || !trenutniKorisnik.id) return alert("Korisnik nije prijavljen."); // Dodatna provjera


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

async function azurirajMojuAktivnost(loggingOut = false) {
    if (!trenutniKorisnik || !trenutniKorisnik.id) return; // Provjeri da korisnik postoji i ima ID
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

// --- GEOLOKACIJA ---
function dohvatiLokaciju(callback) {
    if (!navigator.geolocation) {
        console.warn("Geolokacija nije podržana u ovom pregledniku.");
        return callback && callback(); // Nastavi bez lokacije ako nije podržana
    }
    navigator.geolocation.getCurrentPosition(pos => {
        mojPoz = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        console.log("Geolokacija uspješno dobivena:", mojPoz); // LOG: Potvrda lokacije
        callback && callback();
    }, (error) => {
        console.error("Greška pri dohvaćanju geolokacije:", error); // LOG: Greška geolokacije
        if (error.code === error.PERMISSION_DENIED) {
             alert("Pristup lokaciji je odbijen. Molimo odobrite pristup lokaciji u postavkama preglednika za ovu stranicu.");
        } else {
             alert("Nismo dobili geolokaciju. Molimo odobrite pristup lokaciji. Bez lokacije nećete moći objavljivati pijanke.");
        }
        callback && callback(); // Nastavi i ako je greška
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

// --- OBJAVE (PIJANKE) LOGIKA ---
function pokaziObjavu() {
    swap("lokacijePrikaz", "glavniDio");
    const glavniNaslovEl = document.getElementById("glavniNaslov");
    const profilKorisnikaEl = document.getElementById("profilKorisnika");
    const objavaFormaEl = document.getElementById("objavaForma");
    const opisPijankeEl = document.getElementById("opisPijanke");

    if (glavniNaslovEl) glavniNaslovEl.innerText = "Objavi pijanku";
    if (profilKorisnikaEl) profilKorisnikaEl.style.display = "none";
    if (objavaFormaEl) objavaFormaEl.style.display = "block";
    if (opisPijankeEl) opisPijankeEl.value = "";
}

async function objaviPijanku() {
    const opisPijankeEl = document.getElementById("opisPijanke");
    const opis = opisPijankeEl ? opisPijankeEl.value.trim() : '';

    if (!opis) return alert("Molimo popunite opis pijanke!");

    if (!mojPoz || mojPoz.lat === null || mojPoz.lon === null) {
        console.log("Lokacija nije dostupna, pokušavam ponovno dohvatiti."); // LOG
        // Pozivamo dohvatiLokaciju s callbackom koji ponovno poziva objaviPijanku
        return dohvatiLokaciju(() => objaviPijanku());
    }

    console.log("Objavljujem pijanku s lokacijom:", mojPoz); // LOG

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

async function obrisiPijanku(pijankaId, event) {
    if (event) event.stopPropagation(); // Spriječi otvaranje profila ako je kliknuto na delete dugme
    if (!pijankaId) {
        console.error("Pokušaj brisanja pijanke bez ID-a.");
        return;
    }

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
        // Provjeravamo da li pijanka ima id property (koji je _id.toString() sa backenda)
        if (!pijanka.id) {
            console.error("Pijanka nema ID (ili je '_id' nedostupan):", pijanka);
            return; // Preskoči ako nema ID
        }

        // Pronađi autora iz globalno dohvaćenih sviKorisnici
        const autor = sviKorisnici.find(u => u.id === pijanka.korisnikId);
        if (!autor) {
            console.error("Autor pijanke nije pronađen za ID:", pijanka.korisnikId, "Pijanka:", pijanka);
            // Možeš dodati fallback prikaz ili preskočiti ovu objavu
            return;
        }

        const status = formatirajStatus(autor.lastActive);
        div.innerHTML += `
            <div class="pijanka">
                <div class="pijanka-header" onclick="otvoriProfil('${autor.id}')">
                    <img src="${autor.slika}" alt="Profilna slika" class="pijanka-profilna-slika">
                    <div class="pijanka-info">
                        <div>
                            <span class="status-dot ${status.online?"online":"offline"}"></span>
                            <strong>${autor.ime}</strong>
                        </div>
                        <p class="status-text">pije ${distKM(mojPoz, pijanka)}km od tebe</p>
                    </div>
                    ${autor.id === trenutniKorisnik.id ? `<button class="delete-btn" onclick="obrisiPijanku('${pijanka.id}', event)">🗑️</button>` : ""}
                </div>
                <div class="pijanka-opis">
                    <p>${pijanka.opis}</p>
                </div>
            </div>
            <hr class="pijanka-separator">
        `;
    });
}

async function otvoriProfil(korisnikId) {
    if (!korisnikId) return; // Provjeri da korisnikId postoji

    try {
        const response = await authenticatedFetch(`/api/users/${korisnikId}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Korisnik nije pronađen.");
        }
        const korisnik = await response.json();

        swap("lokacijePrikaz", "glavniDio");
        const glavniNaslovEl = document.getElementById("glavniNaslov");
        const objavaFormaEl = document.getElementById("objavaForma");
        const divProfil = document.getElementById("profilKorisnika");

        if (glavniNaslovEl) glavniNaslovEl.innerText = "Profil korisnika";
        if (objavaFormaEl) objavaFormaEl.style.display = "none";
        if (divProfil) {
            divProfil.style.display = "block";
            divProfil.innerHTML = `<div style="text-align:center; cursor:default; display:block;">
                <img src="${korisnik.slika}" class="profilna-slika" style="margin-bottom:15px;">
                <h2 style="display:block; vertical-align:middle;">${korisnik.ime}</h2>
                <p style="font-size:15px; font-style:italic; color:#ccc;">${korisnik.opis || "Nema opisa."}</p>
                <div style="margin:20px 0;">${prikaziMreze(korisnik)}</div>
                ${korisnik.id !== trenutniKorisnik.id ? `<button onclick="pokreniPrivatniChat('${korisnik.id}', 'glavniDio')">💬 Pošalji poruku</button>` : '<em style="color:#888;">Ovo je tvoj profil.</em>'}
            </div>`;
        }
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

// --- LOGIKA INBOXA I PORUKA ---
function azurirajNotifikacije() {
    let neprocitane = 0;
    const badgeContainer = document.getElementById("notifikacijaPoruka");
    if (!badgeContainer) return;

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

async function prikaziInbox() {
    const div = document.getElementById("listaChatova");
    if (!div) return;

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
        if (!partner) {
             console.error("Partner za chat nije pronađen za ID:", partnerId);
             return;
        }

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

let prethodniEkran = "lokacijePrikaz";

async function pokreniPrivatniChat(partnerId, saEkrana) {
    prethodniEkran = saEkrana;
    trenutniChatPartnerId = partnerId;
    const primalac = sviKorisnici.find(u => u.id === partnerId);
    if (!primalac) return;

    const chatSaKorisnikomEl = document.getElementById("chatSaKorisnikom");
    if (chatSaKorisnikomEl) chatSaKorisnikomEl.innerText = primalac.ime;

    // Označi poruke kao pročitane na serveru
    const chatKey = [trenutniKorisnik.id, trenutniChatPartnerId].sort().join("-");
    try {
        const markReadResponse = await authenticatedFetch('/api/messages', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatKey: chatKey })
        });
        if (markReadResponse.ok) {
            await dohvatiSvePoruke(); // Osvježi lokalne poruke nakon markiranja kao pročitanih
            azurirajNotifikacije();
        } else {
            console.error("Greška pri označavanju poruka kao pročitanih:", await markReadResponse.text());
        }
    } catch (error) {
        console.error("Greška pri označavanju poruka kao pročitanih (catch):", error);
    }

    const azurirajStatusSagovornika = () => {
        const svezPartner = sviKorisnici.find(u => u.id === partnerId);
        if (svezPartner) {
            const status = formatirajStatus(svezPartner.lastActive);
            const chatPartnerStatusEl = document.getElementById("chatPartnerStatus");
            if (chatPartnerStatusEl) chatPartnerStatusEl.innerText = status.text;
        }
    };
    if (chatStatusInterval) clearInterval(chatStatusInterval);
    chatStatusInterval = setInterval(azurirajStatusSagovornika, 5e3);
    azurirajStatusSagovornika();
    swap(prethodniEkran, "privatniChat");
    prikaziPrivatniLog();
}

async function posaljiPrivatno() {
    const privatniInputEl = document.getElementById("privatniInput");
    const tekst = privatniInputEl ? privatniInputEl.value.trim() : '';

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
            if (privatniInputEl) privatniInputEl.value = "";
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
    if (!div) return;

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

// --- FUNKCIJE ZA DOHVAĆANJE PODATAKA SA SERVERA ---
async function dohvatiSveKorisnike() {
    try {
        const response = await authenticatedFetch('/api/users');
        if (response.ok) {
            sviKorisnici = await response.json();
            console.log("Dohvaćeni svi korisnici:", sviKorisnici); // LOG
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
            console.log("Dohvaćene pijanke:", svePijanke); // LOG
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
            console.log("Dohvaćene poruke:", privatnePoruke); // LOG
        } else {
            console.error("Greška pri dohvaćanju poruka:", await response.text());
            privatnePoruke = {};
        }
    } catch (error) {
        console.error("Greška mreže pri dohvaćanju poruka:", error);
        privatnePoruke = {};
    }
}