// ===================================================================
// RESET SCRIPT.JS - Maksimalno pojednostavljena logika
// ===================================================================

// Globalna varijabla koja prati trenutno vidljiv ekran
let trenutniAktivniEkranId = null;

// Glavni događaj koji se pokreće kad se stranica učita
window.addEventListener('DOMContentLoaded', () => {
    console.log("Stranica učitana. Pokrećem skriptu.");

    // Sakrij splash screen nakon 1.5 sekunde
    const splashScreen = document.getElementById('splashScreen');
    setTimeout(() => {
        if (splashScreen) {
            splashScreen.classList.add('hidden');
        }
        // Prikazi glavni omotač aplikacije
        document.getElementById('pageWrapper').style.display = 'block';

        // Odluči koji dio aplikacije prikazati
        const token = localStorage.getItem('token');
        if (token) {
            // Ako korisnik IMA token (ulogiran je)
            console.log("Token pronađen. Pokrećem glavnu aplikaciju.");
            pokreniGlavnuAplikaciju();
        } else {
            // Ako korisnik NEMA token
            console.log("Nema tokena. Prikazujem ekran za prijavu.");
            prikaziLoginEkrane();
        }
    }, 1500);
});

/**
 * Jednostavna i pouzdana funkcija za promjenu ekrana.
 * @param {string} id - ID kontejnera koji treba prikazati.
 */
function swapTo(id) {
    // Prvo sakrij stari ekran ako postoji
    if (trenutniAktivniEkranId) {
        const stariEkran = document.getElementById(trenutniAktivniEkranId);
        if (stariEkran) {
            stariEkran.classList.remove('active');
        }
    }
    
    // Zatim prikaži novi ekran
    const noviEkran = document.getElementById(id);
    if (noviEkran) {
        noviEkran.classList.add('active');
        trenutniAktivniEkranId = id; // Postavi novi ekran kao trenutno aktivni
        console.log("Prebačeno na ekran:", id);
    } else {
        console.error("Greška: Ekran s ID-om '" + id + "' ne postoji.");
    }
}

/**
 * Funkcija koja se poziva ako korisnik NIJE ulogiran.
 */
function prikaziLoginEkrane() {
    // Sakrij header i footer od glavne aplikacije
    document.getElementById('appHeader').style.display = 'none';
    document.getElementById('appFooter').style.display = 'none';
    
    // Prikaži početni ekran 'intro'
    swapTo('intro');
}

/**
 * Funkcija koja se poziva ako korisnik JEST ulogiran.
 */
function pokreniGlavnuAplikaciju() {
    // Prikaži header i footer od glavne aplikacije
    document.getElementById('appHeader').style.display = 'flex';
    document.getElementById('appFooter').style.display = 'flex';

    // Ovdje bi inače išlo dohvaćanje podataka s servera (fetch)
    // Za sada, samo prebacujemo na glavni ekran
    swapTo('lokacijePrikaz');

    // Poveži listenere za gumbe u headeru i footeru
    poveziAppListenere();
}


/**
 * Funkcija koja povezuje klikove na gumbe koji su vidljivi TEK NAKON prijave.
 */
function poveziAppListenere() {
    document.getElementById('profilIcon').onclick = () => {
        alert("Kliknuo si na PROFIL ikonu!");
        // Ovdje će ići tvoja logika za prikaz profila, npr. swapTo('profilMeni')
    };
    
    document.getElementById('porukeIcon').onclick = () => {
        alert("Kliknuo si na PORUKE ikonu!");
        // Ovdje će ići tvoja logika za prikaz poruka, npr. swapTo('inboxPrikaz')
    };

    document.getElementById('novaObjavaBtn').onclick = () => {
        alert("Kliknuo si na PLUS za objavu!");
        // Ovdje će ići tvoja logika za objavu, npr. swapTo('glavniDio')
    };
}

// Ovdje možeš staviti ostatak svojih funkcija (registruj, ulogujSe, itd.)
// Za sada su prazne da bismo se fokusirali samo na to da UI radi.
function ulogujSe() {
    // Privremena simulacija logina za testiranje
    console.log("Simuliram login...");
    localStorage.setItem('token', 'neki-testni-token'); // Postavi lažni token
    pokreniGlavnuAplikaciju(); // Pokreni glavnu app
}