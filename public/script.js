// public/script.js

// Globalne varijable
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

// --- POČETNO UČITAVANJE APLIKACIJE ---
window.addEventListener('DOMContentLoaded', async function() {
    localStorage.removeItem("loggedInUserId"); // Čišćenje starog, lokalnog ID-a

    const token = localStorage.getItem("token");
    console.log("DOMContentLoaded: Pokušavam dohvatiti token:", token ? "Token pronađen" : "Nema tokena");

    const splashScreen = document.getElementById('splashScreen');

    // Inicijalno sakrij sve kontejnere osim splash screena.
    // Ukloni active-screen klase koje bi mogle ostati iz prethodnih sesija
    document.querySelectorAll('.container').forEach(el => {
        if (el.id !== 'splashScreen') {
            el.style.display = 'none'; // Sakrij odmah
            el.classList.remove('active-screen', 'fade-out-screen'); // Osiguraj čisto stanje
        }
    });

    let appReadyToStart = false; // Flag za praćenje je li aplikacija spremna za pokretanje

    if (token) {
        try {
            const response = await authenticatedFetch('/api/auth/me');
            console.log("DOMContentLoaded: Odgovor od /api/auth/me (status):", response.status);

            if (response.ok) {
                const data = await response.json();
                trenutniKorisnik = data.user;
                console.log("DOMContentLoaded: Korisnik uspješno autentificiran:", trenutniKorisnik.ime);

                await Promise.all([
                    dohvatiSveKorisnike(),
                    dohvatiSvePijanke(),
                    dohvatiSvePoruke()
                ]);
                console.log("DOMContentLoaded: Svi početni podaci dohvaćeni.");
                appReadyToStart = true; // Aplikacija je spremna za pokretanje
            } else {
                console.warn("DOMContentLoaded: Token nevalidan ili istekao, odjavljujem korisnika (status:", response.status, ").");
                localStorage.removeItem("token");
            }
        } catch (error) {
            console.error("DOMContentLoaded: Greška pri provjeri tokena ili mreži (catch blok):", error);
            localStorage.removeItem("token");
        }
    } else {
        console.log("DOMContentLoaded: Nema tokena, prikazujem intro ekran.");
    }

    // Skrivanje splash screena nakon 2 sekunde
    if (splashScreen) {
        setTimeout(() => {
            splashScreen.style.animation = 'fadeOutSplash 0.5s ease-out forwards'; // Koristi novu animaciju
            setTimeout(() => {
                splashScreen.style.display = 'none';
                splashScreen.remove(); // Ukloni element nakon animacije ako više nije potreban

                // Nakon što se splash screen skloni, pokreni aplikaciju ili prikaži intro
                if (appReadyToStart) {
                    pokreniAplikaciju();
                } else {
                    // Ako nije spreman za pokretanje (nema tokena/greška), prikaži intro
                    const introEl = document.getElementById('intro');
                    if (introEl) {
                        introEl.style.display = 'block';
                        // Dodaj klasu s malim timeoutom da se CSS tranzicija aktivira
                        setTimeout(() => introEl.classList.add('active-screen'), 10);
                    }
                }
            }, 500); // 500ms je trajanje fadeOutSplash animacije
        }, 2000); // Čekaj 2 sekunde prije nego što počne nestajati
    } else {
        // Ako nema splash screena (npr. dev okruženje), odmah pokreni aplikaciju ili prikaži intro
        if (appReadyToStart) {
            pokreniAplikaciju();
        } else {
            const introEl = document.getElementById('intro');
            if (introEl) {
                introEl.style.display = 'block';
                // Dodaj klasu s malim timeoutom da se CSS tranzicija aktivira
                setTimeout(() => introEl.classList.add('active-screen'), 10);
            }
        }
    }
});

// --- FUNKCIJE ZA PREBACIVANJE EKRANA (UI LOGIKA) ---
function swap(hideId, showId) {
    const hideElement = document.getElementById(hideId);
    const showElement = document.getElementById(showId);

    // Provjeri da showElement postoji prije nego što nastavimo
    if (!showElement) {
        console.error("Target element for swap (showId) not found:", showId);
        return;
    }

    // Funkcija koja će prikazati novi element s animacijom
    const showNewElement = () => {
        showElement.style.display = 'block'; // Prvo ga učini vidljivim (display)
        // ODGODA: Mali timeout da preglednik registrira display:block prije nego što se aktivira tranzicija
        setTimeout(() => {
            showElement.classList.add('active-screen'); // Dodaj klasu za fade-in
        }, 10); // Minimalno kašnjenje od 10ms
    };

    // Ako postoji element za sakriti I on je trenutno aktivan (tj. već ima animaciju)
    if (hideElement && hideElement.classList.contains('active-screen')) {
        hideElement.classList.remove('active-screen'); // Ukloni aktivno stanje
        hideElement.classList.add('fade-out-screen'); // Dodaj klasu za fade-out animaciju

        // Slušaj 'animationend' event kako bismo znali kada se animacija završi
        hideElement.addEventListener('animationend', function handler() {
            hideElement.classList.remove('fade-out-screen'); // Ukloni fade-out klasu
            hideElement.style.display = 'none'; // Sakrij element nakon animacije
            // Važno: Ukloni listener da se ne bi više puta okidao
            hideElement.removeEventListener('animationend', handler);

            // Kada je stari ekran potpuno skriven, prikaži novi
            showNewElement();

        }, { once: true }); // '{ once: true }' osigurava da se listener automatski ukloni nakon prvog okidanja
    } else {
        // Ako nema elementa za sakriti, ili element nije bio "active-screen" (npr. inicijalni prikazi),
        // samo sakrij prethodni (ako postoji) i odmah prikaži novi.
        if (hideElement) { // Ako postoji element za sakriti, ali nije active-screen, samo ga sakrij
             hideElement.style.display = 'none';
             hideElement.classList.remove('active-screen', 'fade-out-screen'); // Osiguraj čisto stanje
        }
        showNewElement(); // Odmah prikaži novi element s animacijom
    }
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
    if (!trenutniKorisnik) return;

    // Dohvati najnovije podatke
    // Smanjio sam interval za globalRefreshUI na 30 sekundi u pokreniAplikaciju
    await Promise.all([
        dohvatiSveKorisnike(),
        dohvatiSvePijanke(),
        dohvatiSvePoruke()
    ]);

    // Ažuriraj UI samo za trenutno vidljive ekrane
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

// --- FUNKCIJE ZA UPLOAD SLIKA (Lokalna obrada Base64) ---
document.addEventListener('DOMContentLoaded', () => {
    const slikaUploadEl = document.getElementById("slikaUpload");
    if (slikaUploadEl) {
        slikaUploadEl.addEventListener("change", function() {
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
    }

    const editSlikaUploadEl = document.getElementById("editSlikaUpload");
    if (editSlikaUploadEl) {
        editSlikaUploadEl.addEventListener("change", function() {
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

        if (response.ok) {
            alert(data.message);
            await ulogujSe(ime, sifra); // Pokušaj automatske prijave
        } else {
            alert("Greška pri registraciji: " + data.message);
        }
    } catch (error) {
        console.error("Greška kod registracije:", error);
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
        const response = await authenticatedFetch('/api/login', { // Koristi authenticatedFetch iako tehnički nema tokena za login
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: ime, password: sifra })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem("token", data.token);
            trenutniKorisnik = data.user;
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
    ["loginIme", "loginSifra", "ime", "sifra", "instagram", "tiktok", "opis", "editIme", "editOpis", "editInstagram", "editTiktok", "opisPijanke", "privatniInput"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // Sakrij sve trenutno aktivne ekrane s animacijom
    document.querySelectorAll('.container.active-screen').forEach(el => {
        el.classList.remove('active-screen');
        el.classList.add('fade-out-screen');
        el.addEventListener('animationend', function handler() {
            el.style.display = 'none';
            el.classList.remove('fade-out-screen');
            el.removeEventListener('animationend', handler);
        }, { once: true });
    });

    // Prikazi intro ekran nakon što se svi ostali sakriju
    const introScreen = document.getElementById('intro');
    if (introScreen) {
        // Dajte malo vremena da se animacije nestajanja završe prije pojavljivanja intro ekrana
        setTimeout(() => {
            introScreen.style.display = 'block';
            introScreen.classList.add('active-screen');
        }, 300); // Ovo bi trebalo biti barem trajanje fade-out animacije
    }
}

// --- LOGIKA POKRETANJA APLIKACIJE NAKON PRIJAVE/REGISTRACIJE ---
function pokreniAplikaciju() {
    console.log("pokreniAplikaciju: Pokrećem glavni dio aplikacije.");

    // Sakrij sve ekrane koji nisu lokacijePrikaz, i ukloni im active-screen ako je prisutan
    // i postavi ih na display:none
    document.querySelectorAll('.container').forEach(el => {
        if (el.id !== "lokacijePrikaz") {
            el.classList.remove('active-screen', 'fade-out-screen'); // Ukloni sve klase animacije
            el.style.display = 'none'; // Odmah sakrij
        }
    });

    // Prikazi lokacijePrikaz s animacijom
    const lokacijePrikazEl = document.getElementById("lokacijePrikaz");
    if (lokacijePrikazEl) {
        lokacijePrikazEl.style.display = "block"; // Prikazi ga
        // Mali timeout da preglednik registrira display:block prije tranzicije
        setTimeout(() => lokacijePrikazEl.classList.add('active-screen'), 10);
    }

    // Poništi prethodne intervale i postavi nove za osvježavanje
    [activityInterval, globalDataRefreshInterval].forEach(i => i && clearInterval(i));
    activityInterval = setInterval(azurirajMojuAktivnost, 15e3);
    globalDataRefreshInterval = setInterval(globalRefreshUI, 30e3);

    azurirajMojuAktivnost();
    dohvatiLokaciju(() => {
        prikaziPijankePregled();
        azurirajNotifikacije();
    });
    console.log("pokreniAplikaciju: Aplikacija pokrenuta, intervali postavljeni.");
}

// --- LOGIKA PROFILA I UREĐIVANJA PROFILA ---
async function prikaziEditProfila() {
    if (!trenutniKorisnik || !trenutniKorisnik.id) return;
    try {
        const response = await authenticatedFetch(`/api/users/${trenutniKorisnik.id}`);
        if (response.ok) {
            const user = await response.json();
            document.getElementById("editIme").value = user.ime || '';
            document.getElementById("editOpis").value = user.opis || '';
            document.getElementById("editInstagram").value = user.instagram || '';
            document.getElementById("editTiktok").value = user.tiktok || '';
            document.getElementById("previewEditSlike").src = user.slika || '';
            odabranaEditSlika = null;
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
    const novoIme = document.getElementById("editIme").value.trim();
    const noviOpis = document.getElementById("editOpis").value.trim();
    const noviInstagram = document.getElementById("editInstagram").value.trim();
    const noviTiktok = document.getElementById("editTiktok").value.trim();

    if (!novoIme) return alert("Ime ne može biti prazno!");
    if (!trenutniKorisnik || !trenutniKorisnik.id) return alert("Korisnik nije prijavljen.");

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
            trenutniKorisnik.ime = novoIme;
            trenutniKorisnik.opis = noviOpis;
            trenutniKorisnik.instagram = noviInstagram;
            trenutniKorisnik.tiktok = noviTiktok;
            if (odabranaEditSlika) {
                trenutniKorisnik.slika = odabranaEditSlika;
            }
            await globalRefreshUI();
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
        return callback && callback();
    }
    navigator.geolocation.getCurrentPosition(pos => {
        mojPoz = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        console.log("Geolokacija uspješno dobivena:", mojPoz);
        callback && callback();
    }, (error) => {
        console.error("Greška pri dohvaćanju geolokacije:", error);
        if (error.code === error.PERMISSION_DENIED) {
             alert("Pristup lokaciji je odbijen. Molimo odobrite pristup lokaciji u postavkama preglednika za ovu stranicu.");
        } else {
             alert("Nismo dobili geolokaciju. Molimo odobrite pristup lokaciji. Bez lokacije nećete moći objavljivati pijanke.");
        }
        callback && callback();
    });
}

function distKM(p1, p2) {
    if (!p1 || !p2 || p1.lat === undefined || p1.lon === undefined || p2.lat === undefined || p2.lon === undefined) return "?";
    const R = 6371,
        dLat = (p2.lat - p1.lat) * Math.PI / 180,
        dLon = (p2.lon - p1.lon) * Math.PI / 180,
        a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

// --- OBJAVE (PIJANKE) LOGIKA ---
function pokaziObjavu() {
    swap("lokacijePrikaz", "glavniDio");
    document.getElementById("glavniNaslov").innerText = "Objavi pijanku";
    document.getElementById("profilKorisnika").style.display = "none";
    document.getElementById("objavaForma").style.display = "block";
    document.getElementById("opisPijanke").value = "";
}

async function objaviPijanku() {
    const opis = document.getElementById("opisPijanke").value.trim();

    if (!opis) return alert("Molimo popunite opis pijanke!");

    if (!mojPoz || mojPoz.lat === null || mojPoz.lon === null) {
        return dohvatiLokaciju(() => objaviPijanku()); // Ponovi ako lokacija nije dostupna
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
            await dohvatiSvePijanke();
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
    if (event) event.stopPropagation();
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
                await dohvatiSvePijanke();
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
        if (!pijanka.id) {
            console.error("Pijanka nema ID (ili je '_id' nedostupan):", pijanka);
            return;
        }

        const autor = sviKorisnici.find(u => u.id === pijanka.korisnikId);
        if (!autor) {
            console.error("Autor pijanke nije pronađen za ID:", pijanka.korisnikId, "Pijanka:", pijanka);
            return;
        }

        const status = formatirajStatus(autor.lastActive);
        div.innerHTML += `
            <div class="pijanka">
                <div class="pijanka-header" onclick="otvoriProfil('<span class="math-inline">\{autor\.id\}'\)"\>
<img src\="</span>{autor.slika}" alt="Profilna slika" class="pijanka-profilna-slika">
                    <div class="pijanka-info">
                        <div>
                            <span class="status-dot <span class="math-inline">\{status\.online?"online"\:"offline"\}"\></span\>
<strong\></span>{autor.ime}</strong>
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
    if (!korisnikId) return;

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
        if (divProfil) {
            divProfil.style.display = "block";
            divProfil.innerHTML = `<div style="text-align:center; cursor:default; display:block;">
                <img src="<span class="math-inline">\{korisnik\.slika\}" class\="profilna\-slika" style\="margin\-bottom\:15px;"\>
<h2 style\="display\:block; vertical\-align\:middle;"\></span>{korisnik.ime}</h2>
                <p style="font-size:15px; font-style:italic; color:#ccc;"><span class="math-inline">\{korisnik\.opis \|\| "Nema opisa\."\}</p\>
<div style\="margin\:20px 0;"\></span>{prikaziMreze(korisnik)}</div>
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
        swap("lokacijePrikaz", "inboxPrikaz"); // Prebacite se na inbox ekran čak i ako nema poruka
        return;
    }

    chatKeys.sort((a, b) => {
        const lastMsgA = privatnePoruke[a][privatnePoruke[a].length - 1];
        const lastMsgB = privatnePoruke[b][privatnePoruke[b].length - 1];
        if (!lastMsgA || !lastMsgB) return 0;
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
            <img src="<span class="math-inline">\{partner\.slika\}" alt\="profilna"\>
<div class\="chat\-item\-info" onclick\="pokreniPrivatniChat\('</span>{partner.id}', 'inboxPrikaz')">
                <div>
                    <span class="status-dot <span class="math-inline">\{status\.online?"online"\:"offline"\}"\></span\>
<strong\></span>{partner.ime}</strong>
                </div>
                <p class="status-text">${status.online?"Online":status.text}</p>
            </div>
            ${neprocitane?'<span class="notification-badge" style="position:relative; top:0; right:0;"></span>':""}
        </div>`;
    });
    swap("lokacijePrikaz", "inboxPrikaz");
}

async function pokreniPrivatniChat(partnerId, saEkrana) {
    prethodniEkran = saEkrana;
    trenutniChatPartnerId = partnerId;
    const primalac = sviKorisnici.find(u => u.id === partnerId);
    if (!primalac) return;

    document.getElementById("chatSaKorisnikom").innerText = primalac.ime;

    const chatKey = [trenutniKorisnik.id, trenutniChatPartnerId].sort().join("-");
    try {
        const markReadResponse = await authenticatedFetch('/api/messages', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatKey: chatKey })
        });
        if (markReadResponse.ok) {
            await dohvatiSvePoruke();
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
            document.getElementById("chatPartnerStatus").innerText = status.text;
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
    const tekst = privatniInputEl.value.trim();

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
            privatniInputEl.value = "";
            await dohvatiSvePoruke();
            prikaziPrivatniLog();
            globalRefreshUI();
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

    div.innerHTML = log.map(msg => `<p class="<span class="math-inline">\{msg\.autorId \=\=\= trenutniKorisnik\.id ? "moja\-poruka" \: "tudja\-poruka"\}"\><span\></span>{msg.tekst}</span></p>`).join("");
    div.scrollTop = div.scrollHeight; // Skrolaj na dno chata
}

function zatvoriPrivatni() {
    if (chatStatusInterval) clearInterval(chatStatusInterval);
    trenutniChatPartnerId = null;
    document.getElementById("privatniInput").value = "";
    swap("privatniChat", prethodniEkran);
    if (prethodniEkran === "inboxPrikaz") prikaziInbox();
}

// --- FUNKCIJE ZA DOHVAĆANJE PODATAKA SA SERVERA ---
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