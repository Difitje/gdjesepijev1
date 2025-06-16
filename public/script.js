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

// --- FUNKCIJA ZA KOMPRESIJU SLIKE PRIJE UPLOADA ---
// Smanjuje dimenzije i kvalitetu Base64 slike
function compressImage(base64Image, maxWidth = 400, quality = 0.8) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Image;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Smanji dimenzije ako su veće od maxWidth
            if (width > maxWidth) {
                height = height * (maxWidth / width);
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Kompresiraj na JPEG format s određenom kvalitetom
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => {
            // Ako dođe do greške pri učitavanju slike, vrati original
            console.error("Greška pri učitavanju slike za kompresiju.");
            resolve(base64Image);
        };
    });
}

// --- POČETNO UČITAVANJE APLIKACIJE ---
window.addEventListener('DOMContentLoaded', async function() {
    localStorage.removeItem("loggedInUserId"); // Čišćenje starog, lokalnog ID-a

    const token = localStorage.getItem("token");
    console.log("DOMContentLoaded: Pokušavam dohvatiti token:", token ? "Token pronađen" : "Nema tokena");

    const splashScreen = document.getElementById('splashScreen');

    // Inicijalno sakrij sve kontejnere osim splash screena.
    document.querySelectorAll('.container').forEach(el => {
        if (el.id !== 'splashScreen') {
            el.style.display = 'none'; // Sakrij odmah
            el.classList.remove('active-screen', 'fade-out-screen'); // Osiguraj čisto stanje
        }
    });

    let appInitializedSuccessfully = false; // Flag za praćenje je li aplikacija spremna za pokretanje

    if (token) {
        try {
            const response = await authenticatedFetch('/api/auth/me');
            console.log("DOMContentLoaded: Odgovor od /api/auth/me (status):", response.status);

            if (response.ok) {
                const data = await response.json();
                trenutniKorisnik = data.user;
                console.log("DOMContentLoaded: Korisnik uspješno autentificiran:", trenutniKorisnik.ime);

                // **KLJUČNO**: Dohvati sve potrebne podatke prije pokretanja aplikacije
                await Promise.all([
                    dohvatiSveKorisnike(),
                    dohvatiSvePijanke(),
                    dohvatiSvePoruke()
                ]);
                console.log("DOMContentLoaded: Svi početni podaci dohvaćeni.");
                appInitializedSuccessfully = true; // Svi podaci su tu
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
                if (appInitializedSuccessfully) {
                    pokreniAplikaciju();
                } else {
                    // Ako nije spremno (nema tokena/greška), prikaži intro
                    const introEl = document.getElementById('intro');
                    if (introEl) {
                        introEl.style.display = 'block';
                        setTimeout(() => introEl.classList.add('active-screen'), 10);
                    }
                }
            }, 500); // 500ms je trajanje fadeOutSplash animacije
        }, 2000); // Čekaj 2 sekunde prije nego što počne nestajati
    } else {
        // Ako nema splash screena (npr. dev okruženje), odmah pokreni aplikaciju ili prikaži intro
        if (appInitializedSuccessfully) {
            pokreniAplikaciju();
        } else {
            const introEl = document.getElementById('intro');
            if (introEl) {
                introEl.style.display = 'block';
                setTimeout(() => introEl.classList.add('active-screen'), 10);
            }
        }
    }
});

// --- FUNKCIJE ZA PREBACIVANJE EKRANA (UI LOGIKA) ---
function swap(hideId, showId) {
    const hideElement = document.getElementById(hideId);
    const showElement = document.getElementById(showId);

    if (!showElement) {
        console.error("Target element for swap (showId) not found:", showId);
        return;
    }

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

        hideElement.addEventListener('animationend', function handler() {
            hideElement.classList.remove('fade-out-screen'); // Ukloni fade-out klasu
            hideElement.style.display = 'none'; // Sakrij element nakon animacije
            hideElement.removeEventListener('animationend', handler); // Važno: Ukloni listener

            showNewElement(); // Prikazi novi element tek nakon što stari nestane
        }, { once: true }); // '{ once: true }' osigurava da se listener automatski ukloni nakon prvog okidanja
    } else {
        // Ako nema elementa za sakriti, ili element nije bio "active-screen" (npr. inicijalni prikazi),
        // samo sakrij prethodni (ako postoji) i odmah prikaži novi.
        if (hideElement) {
             hideElement.style.display = 'none';
             hideElement.classList.remove('active-screen', 'fade-out-screen'); // Osiguraj čisto stanje
        }
        showNewElement(); // Odmah prikaži novi element
    }
}

// NOVA FUNKCIJA ZA ZATVARANJE EKRANA (KLIKOM NA X)
function zatvoriEkran(trenutniEkranId, povratniEkranId) {
    swap(trenutniEkranId, povratniEkranId);
    // Dodatne akcije pri zatvaranju određenih ekrana
    if (trenutniEkranId === 'privatniChat') {
        if (chatStatusInterval) clearInterval(chatStatusInterval);
        trenutniChatPartnerId = null;
        document.getElementById("privatniInput").value = "";
    }
    azurirajNotifikacije(); // Osvježi notifikacije ako se mijenja stanje
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
                        if (previewElement.style.display === "none") { // Ako je skriven, prikaži ga
                            previewElement.style.display = "block";
                        }
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
    const registrujBtn = document.querySelector('#registracija button'); // Dohvati gumb za feedback

    const ime = imeInput ? imeInput.value.trim() : '';
    const sifra = sifraInput ? sifraInput.value.trim() : '';
    const instagram = instagramInput ? instagramInput.value.trim() : '';
    const tiktok = tiktokInput ? tiktokInput.value.trim() : '';
    const opis = opisInput ? opisInput.value.trim() : '';

    if (!ime || !sifra || !odabranaSlika) {
        return alert("Molimo popunite korisničko ime, lozinku i odaberite sliku!");
    }

    // Prikaz loading stanja
    if (registrujBtn) {
        registrujBtn.disabled = true;
        registrujBtn.textContent = 'Registracija u tijeku...';
    }

    try {
        // Kompresiraj sliku prije slanja
        const compressedSlika = await compressImage(odabranaSlika);

        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: ime,
                password: sifra,
                slika: compressedSlika, // KORISTI KOMPRESIRANU SLIKU
                instagram,
                tiktok,
                opis
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            await ulogujSe(ime, sifra);
        } else {
            alert("Greška pri registraciji: " + data.message);
        }
    } catch (error) {
        console.error("Greška kod registracije:", error);
        alert("Došlo je do greške pri registraciji.");
    } finally {
        // Vrati originalno stanje gumba
        if (registrujBtn) {
            registrujBtn.disabled = false;
            registrujBtn.textContent = 'Spremi';
        }
    }
}

async function ulogujSe(usernameFromRegister = null, passwordFromRegister = null) {
    const loginImeInput = document.getElementById("loginIme");
    const loginSifraInput = document.getElementById("loginSifra");
    const loginBtn = document.querySelector('#login button'); // Dohvati login gumb

    const ime = usernameFromRegister || (loginImeInput ? loginImeInput.value.trim() : '');
    const sifra = passwordFromRegister || (loginSifraInput ? loginSifraInput.value.trim() : '');

    if (!ime || !sifra) {
        return alert("Unesite korisničko ime i lozinku!");
    }

    // Prikaz loading stanja
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Prijava u tijeku...';
    }

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
            await Promise.all([
                dohvatiSveKorisnike(),
                dohvatiSvePijanke(),
                dohvatiSvePoruke()
            ]);
            pokreniAplikaciju();
        } else {
            alert("Greška pri prijavi: " + data.message);
        }
    } catch (error) {
        console.error("Greška kod prijave:", error);
        alert("Došlo je do greške pri prijavi.");
    } finally {
        // Vrati originalno stanje gumba
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Prijavi se';
        }
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

    document.querySelectorAll('.container.active-screen').forEach(el => {
        el.classList.remove('active-screen');
        el.classList.add('fade-out-screen');
        el.addEventListener('animationend', function handler() {
            el.style.display = 'none';
            el.classList.remove('fade-out-screen');
            el.removeEventListener('animationend', handler);
        }, { once: true });
    });

    const introScreen = document.getElementById('intro');
    if (introScreen) {
        setTimeout(() => {
            introScreen.style.display = 'block';
            setTimeout(() => introScreen.classList.add('active-screen'), 10);
        }, 300);
    }
}

// --- LOGIKA POKRETANJA APLIKACIJE NAKON PRIJAVE/REGISTRACIJE ---
function pokreniAplikaciju() {
    console.log("pokreniAplikaciju: Pokrećem glavni dio aplikacije.");

    document.querySelectorAll('.container').forEach(el => {
        if (el.id !== "lokacijePrikaz") {
            el.classList.remove('active-screen', 'fade-out-screen');
            el.style.display = 'none';
        }
    });

    const lokacijePrikazEl = document.getElementById("lokacijePrikaz");
    if (lokacijePrikazEl) {
        lokacijePrikazEl.style.display = 'block';
        setTimeout(() => lokacijePrikazEl.classList.add('active-screen'), 10);
    }

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

// NOVA FUNKCIJA ZA PRIKAZ EKRANA POSTAVKI
function pokaziPostavkeEkran() {
    prethodniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz';
    swap(prethodniEkran, 'postavkeEkran'); // Prebaci na novi ekran postavki
    azurirajNotifikacije(); // Osvježi notifikacije na novom ekranu
}


async function prikaziEditProfila() {
    if (!trenutniKorisnik || !trenutniKorisnik.id) return;
    
    // Prikaz loading stanja dok se profil učitava
    const editProfilScreen = document.getElementById("editProfil");
    if (editProfilScreen) {
        editProfilScreen.innerHTML = `
            <h2>Uredi profil</h2>
            <div class="close-btn-container">
                <button class="close-btn" onclick="zatvoriEkran('editProfil', 'postavkeEkran')">✖</button>
            </div>
            <p style="text-align:center;">Učitavam profil...</p>
            <div style="text-align:center; margin-top:20px;">⚙️</div>
        `; // Možeš dodati i spinner ovdje umjesto zupčanika
        swap(document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz', "editProfil");
    }

    try {
        const response = await authenticatedFetch(`/api/users/${trenutniKorisnik.id}`);
        if (response.ok) {
            const user = await response.json();
            // Vrati originalni sadržaj i popuni ga podacima
            if (editProfilScreen) {
                 editProfilScreen.innerHTML = `
                    <h2>Uredi profil</h2>
                    <div class="close-btn-container">
                        <button class="close-btn" onclick="zatvoriEkran('editProfil', 'postavkeEkran')">✖</button>
                    </div>
                    <div style="text-align:center;">
                        <img id="previewEditSlike" class="profilna-slika" />
                    </div>
                    <input id="editIme" placeholder="Korisničko ime" />
                    <textarea id="editOpis" placeholder="O meni..." rows="3"></textarea>
                    <input id="editInstagram" placeholder="Instagram korisničko ime" />
                    <input id="editTiktok" placeholder="TikTok korisničko ime" />
                    <label style="font-size:14px; display:block; margin-bottom:5px;">Promijeni profilnu sliku:</label>
                    <input type="file" id="editSlikaUpload" accept="image/*" />
                    <button onclick="sacuvajProfil()">Spremi promjene</button>
                `;
                // Sada popuni inpute
                document.getElementById("editIme").value = user.ime || '';
                document.getElementById("editOpis").value = user.opis || '';
                document.getElementById("editInstagram").value = user.instagram || '';
                document.getElementById("editTiktok").value = user.tiktok || '';
                document.getElementById("previewEditSlike").src = user.slika || 'default_profile.png';
                document.getElementById("previewEditSlike").style.display = "block"; // Osiguraj da je vidljiva
                odabranaEditSlika = null;
            }
            prethodniEkran = 'postavkeEkran'; // Postavi prethodni ekran za vraćanje

            // Ponovno pripoji event listenere za upload slike nakon što se DOM ponovno generira
            const editSlikaUploadEl = document.getElementById("editSlikaUpload");
            if (editSlikaUploadEl) {
                editSlikaUploadEl.removeEventListener("change", handleEditSlikaUploadChange); // Ukloni prethodni ako postoji
                editSlikaUploadEl.addEventListener("change", handleEditSlikaUploadChange); // Dodaj novi
            }


        } else {
            const errorData = await response.json();
            alert("Greška pri dohvaćanju profila: " + errorData.message);
            // U slučaju greške, vrati se na prethodni ekran ili prikaži error
            zatvoriEkran('editProfil', prethodniEkran); 
        }
    } catch (error) {
        console.error("Greška mreže pri dohvaćanju profila:", error);
        alert("Došlo je do greške pri dohvaćanju profila.");
        zatvoriEkran('editProfil', prethodniEkran);
    }
}

// Funkcija za handle-anje promjene slike za edit profila, da se može ponovno pripojiti
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
// Pripojiti ga pri DOMContentLoaded da radi i prvi put
document.addEventListener('DOMContentLoaded', () => {
    const editSlikaUploadEl = document.getElementById("editSlikaUpload");
    if (editSlikaUploadEl) {
        editSlikaUploadEl.addEventListener("change", handleEditSlikaUploadChange);
    }
});


async function sacuvajProfil() {
    const novoIme = document.getElementById("editIme").value.trim();
    const noviOpis = document.getElementById("editOpis").value.trim();
    const noviInstagram = document.getElementById("editInstagram").value.trim();
    const noviTiktok = document.getElementById("editTiktok").value.trim();
    const sacuvajBtn = document.querySelector('#editProfil button');

    if (!novoIme) return alert("Ime ne može biti prazno!");
    if (!trenutniKorisnik || !trenutniKorisnik.id) return alert("Korisnik nije prijavljen.");

    // Prikaz loading stanja
    if (sacuvajBtn) {
        sacuvajBtn.disabled = true;
        sacuvajBtn.textContent = 'Spremam promjene...';
    }

    let finalSlika = null;
    if (odabranaEditSlika) {
        finalSlika = await compressImage(odabranaEditSlika); // KORISTI KOMPRESIRANU SLIKU
    }

    const updateData = {
        username: novoIme,
        opis: noviOpis,
        instagram: noviInstagram,
        tiktok: noviTiktok
    };
    if (finalSlika) { // Koristi finalSlika
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
            trenutniKorisnik.ime = novoIme;
            trenutniKorisnik.opis = noviOpis;
            trenutniKorisnik.instagram = noviInstagram;
            trenutniKorisnik.tiktok = noviTiktok;
            if (finalSlika) { // Ažuriraj lokalni objekt samo ako je slika poslana
                trenutniKorisnik.slika = finalSlika;
            }
            await globalRefreshUI();
            zatvoriEkran("editProfil", 'postavkeEkran'); // Vraća na postavke ekran
        } else {
            alert("Greška pri spremanju profila: " + data.message);
        }
    } catch (error) {
        console.error("Greška kod spremanja profila:", error);
        alert("Došlo je do greške pri spremanja profila.");
    } finally {
        // Vrati originalno stanje gumba
        if (sacuvajBtn) {
            sacuvajBtn.disabled = false;
            sacuvajBtn.textContent = 'Spremi promjene';
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
    catch (error) {
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
             alert("Pristup lokaciji je odbijen. Molimo odobrite pristup lokaciji u postavkama preglednika za ovu stranicu. Bez lokacije nećete moći objavljivati pijanke.");
             mojPoz = null;
        } else {
            alert("Nismo dobili geolokaciju. Molimo odobrite pristup lokaciji. Bez lokacije nećete moći objavljivati pijanke.");
            mojPoz = null;
        }
        callback && callback();
    }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
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
    // PRETHODNI EKRAN ZA VRACANJE: Postavi ga na 'lokacijePrikaz' jer se tamo ide s njega
    prethodniEkran = 'lokacijePrikaz';
    swap(prethodniEkran, "glavniDio");
    document.getElementById("glavniNaslov").innerText = "Objavi pijanku";
    document.getElementById("profilKorisnika").style.display = "none";
    document.getElementById("objavaForma").style.display = "block";
    document.getElementById("opisPijanke").value = "";
}

async function objaviPijanku() {
    const opis = document.getElementById("opisPijanke").value.trim();
    const objaviBtn = document.querySelector('#objavaForma button');

    if (!opis) return alert("Molimo popunite opis pijanke!");

    if (!mojPoz || mojPoz.lat === null || mojPoz.lon === null) {
        return dohvatiLokaciju(() => objaviPijanku());
    }

    // Prikaz loading stanja
    if (objaviBtn) {
        objaviBtn.disabled = true;
        objaviBtn.textContent = 'Objavljujem...';
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
            zatvoriEkran("glavniDio", "lokacijePrikaz"); // Koristi zatvoriEkran
            prikaziPijankePregled();
        } else {
            alert("Greška pri objavi pijanke: " + data.message);
        }
    } catch (error) {
        console.error("Greška kod objave pijanke:", error);
        alert("Došlo je do greške pri objavi pijanke.");
    } finally {
        // Vrati originalno stanje gumba
        if (objaviBtn) {
            objaviBtn.disabled = false;
            objaviBtn.textContent = 'Objavi';
        }
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
            div.innerHTML += `<div class="pijanka">Autor nepoznat (ID: ${pijanka.korisnikId}) - Greška pri učitavanju.</div>`;
            return;
        }

        const status = formatirajStatus(autor.lastActive);
        div.innerHTML += `
            <div class="pijanka">
                <div class="pijanka-header" onclick="otvoriProfil('${autor.id}')">
                    <img src="${autor.slika || 'default_profile.png'}" alt="Profilna slika" class="pijanka-profilna-slika">
                    <div class="pijanka-info">
                        <div>
                            <span class="status-dot ${status.online?"online":"offline"}"></span>
                            <strong>${autor.ime}</strong>
                        </div>
                        <p class="status-text">pije ${distKM(mojPoz, pijanka)}km od tebe</p>
                    </div>
                    ${trenutniKorisnik && autor.id === trenutniKorisnik.id ? `<button class="delete-btn" onclick="obrisiPijanku('${pijanka.id}', event)">🗑️</button>` : ""}
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

    // Prikaz loading stanja za profil
    const glavniDioScreen = document.getElementById("glavniDio");
    if (glavniDioScreen) {
        glavniDioScreen.innerHTML = `
            <h2 id="glavniNaslov">Profil korisnika</h2>
            <div class="close-btn-container">
                <button class="close-btn" onclick="zatvoriEkran('glavniDio', prethodniEkran)">✖</button>
            </div>
            <p style="text-align:center;">Učitavam profil korisnika...</p>
            <div style="text-align:center; margin-top:20px;">👤</div>
        `;
        prethodniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz';
        swap(prethodniEkran, "glavniDio");
    }

    try {
        const response = await authenticatedFetch(`/api/users/${korisnikId}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Korisnik nije pronađen.");
        }
        const korisnik = await response.json();

        // Vrati originalni sadržaj i popuni ga podacima
        if (glavniDioScreen) {
            glavniDioScreen.innerHTML = `
                <h2 id="glavniNaslov">Profil korisnika</h2>
                <div class="close-btn-container">
                    <button class="close-btn" onclick="zatvoriEkran('glavniDio', prethodniEkran)">✖</button>
                </div>
                <div id="objavaForma" style="display: none;"></div>
                <div id="profilKorisnika" style="display: block;">
                    <div style="text-align:center; cursor:default; display:block;">
                        <img src="${korisnik.slika || 'default_profile.png'}" class="profilna-slika" style="margin-bottom:15px;">
                        <h2 style="display:block; vertical-align:middle;">${korisnik.ime || 'Nepoznat korisnik'}</h2>
                        <p style="font-size:15px; font-style:italic; color:#ccc;">${korisnik.opis || "Nema opisa."}</p>
                        <div style="margin:20px 0;">${prikaziMreze(korisnik)}</div>
                        ${trenutniKorisnik && korisnik.id !== trenutniKorisnik.id ? `<button onclick="pokreniPrivatniChat('${korisnik.id}', 'glavniDio')">💬 Pošalji poruku</button>` : '<em style="color:#888;">Ovo je tvoj profil.</em>'}
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error("Greška pri otvaranju profila:", error);
        alert("Došlo je do greške pri otvaranju profila: " + error.message);
        zatvoriEkran('glavniDio', prethodniEkran); // Vrati se na prethodni ekran u slučaju greške
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
    const badgeContainerInbox = document.getElementById("notifikacijaPoruka"); // Stari ID za inboxPrikaz (trenutno nije u HTML-u)
    const badgeContainerSettings = document.getElementById("notifikacijaPorukaSettings"); // Novi ID za postavkeEkran

    // Čišćenje prethodnog sadržaja badgeova
    if (badgeContainerInbox) badgeContainerInbox.innerHTML = "";
    if (badgeContainerSettings) badgeContainerSettings.innerHTML = "";
    
    if (trenutniKorisnik && trenutniKorisnik.id) {
        for (const chatKey in privatnePoruke) {
            // Check if current user is part of this chatKey
            if (chatKey.includes(trenutniKorisnik.id)) {
                // Filter messages that are not read AND sent by the other party
                neprocitane += privatnePoruke[chatKey].filter(msg => !msg.isRead && msg.autorId !== trenutniKorisnik.id).length;
            }
        }
    }
    
    if (neprocitane > 0) {
        const badgeContent = `${neprocitane > 9 ? '9+' : neprocitane}`; // Samo broj/tekst, span se dodaje u HTML-u
        if (badgeContainerInbox) badgeContainerInbox.innerText = badgeContent;
        if (badgeContainerSettings) badgeContainerSettings.innerText = badgeContent;
        if (badgeContainerInbox) badgeContainerInbox.style.display = 'flex';
        if (badgeContainerSettings) badgeContainerSettings.style.display = 'flex';
    } else {
        if (badgeContainerInbox) badgeContainerInbox.style.display = 'none';
        if (badgeContainerSettings) badgeContainerSettings.style.display = 'none';
    }
}

async function prikaziInbox() {
    const div = document.getElementById("listaChatova");
    if (!div) return;

    div.innerHTML = "";
    const chatKeys = (trenutniKorisnik && trenutniKorisnik.id) ? Object.keys(privatnePoruke).filter(key => key.includes(trenutniKorisnik.id)) : [];

    if (chatKeys.length === 0) {
        div.innerHTML = '<p style="text-align:center;color:#888;">Nemaš još nijednu poruku.</p>';
        // PROMJENA: PRETHODNI EKRAN ZA VRACANJE
        swap(document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz', "inboxPrikaz");
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
                div.innerHTML += `<div class="chat-item">Nepoznat korisnik (ID: ${partnerId}) - Greška pri učitavanju.</div>`;
                return;
        }

        const neprocitane = privatnePoruke[chatKey].some(m => !m.isRead && m.autorId == partner.id);
        const status = formatirajStatus(partner.lastActive);
        div.innerHTML += `<div class="chat-item">
            <img src="${partner.slika || 'default_profile.png'}" alt="profilna">
            <div class="chat-item-info" onclick="pokreniPrivatniChat('${partner.id}', 'inboxPrikaz')">
                <div>
                    <span class="status-dot ${status.online?"online":"offline"}"></span>
                    <strong>${partner.ime}</strong>
                </div>
                <p class="status-text">${status.online?"Online":status.text}</p>
            </div>
            ${neprocitane?'<span class="notification-badge" style="position:static; top:auto; right:auto;"></span>':""}
        </div>`;
    });
    // PROMJENA: PRETHODNI EKRAN ZA VRACANJE
    swap(document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz', "inboxPrikaz");
}

async function pokreniPrivatniChat(partnerId, saEkrana) {
    prethodniEkran = saEkrana;
    trenutniChatPartnerId = partnerId;
    const primalac = sviKorisnici.find(u => u.id === partnerId);
    if (!primalac) {
        console.error("Primalac za chat nije pronađen za ID:", partnerId);
        alert("Korisnik s kojim pokušavate chatati nije pronađen.");
        return;
    }

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
    const posaljiBtn = document.querySelector('#privatniChat button');


    if (!tekst) return;
    if (!trenutniChatPartnerId) {
        alert("Nije odabran partner za chat.");
        return;
    }

    if (posaljiBtn) {
        posaljiBtn.disabled = true;
        posaljiBtn.textContent = 'Šaljem...';
    }

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
    } finally {
        if (posaljiBtn) {
            posaljiBtn.disabled = false;
            posaljiBtn.textContent = 'Pošalji';
        }
    }
}

function prikaziPrivatniLog() {
    if (!trenutniKorisnik || !trenutniKorisnik.id || !trenutniChatPartnerId) {
        console.warn("Nedostaju podaci za prikaz privatnog chata.");
        document.getElementById("privatniChatLog").innerHTML = '<p style="text-align:center; color:#888;">Nema poruka.</p>';
        return;
    }

    const chatKey = [trenutniKorisnik.id, trenutniChatPartnerId].sort().join("-");
    const log = privatnePoruke[chatKey] || [];
    const div = document.getElementById("privatniChatLog");
    if (!div) return;

    div.innerHTML = log.map(msg => `<p class="${msg.autorId === trenutniKorisnik.id ? "moja-poruka" : "tudja-poruka"}"><span>${msg.tekst}</span></p>`).join("");
    div.scrollTop = div.scrollHeight;
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