// NOVO: DODAJTE OVAJ KOD NA SAMI KRAJ VAŠE script.js DATOTEKE

// --- POVEZIVANJE NOVIH ELEMENATA SUČELJA ---
document.addEventListener('DOMContentLoaded', () => {

    const profilIcon = document.getElementById('profilIcon');
    const porukeIcon = document.getElementById('porukeIcon');
    const novaObjavaBtn = document.getElementById('novaObjavaBtn');

    if (profilIcon) {
        profilIcon.addEventListener('click', () => {
            // Pronalazi trenutno aktivni ekran da bi se znali vratiti na njega
            const trenutniAktivniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz';
            prethodniEkran = trenutniAktivniEkran; // Postavljamo globalnu varijablu
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
});


// --- AŽURIRANJE POSTOJEĆE FUNKCIJE ---
// Moramo malo izmijeniti `azurirajNotifikacije` da cilja i novi badge u headeru.
// Pronađite funkciju `azurirajNotifikacije` i ZAMIJENITE je s ovom:

function azurirajNotifikacije() {
    let neprocitane = 0;
    // Novi badge u headeru
    const badgeHeader = document.getElementById("notifikacijaPorukaHeader");
    
    // Stari badge (možete ga ostaviti ako ga ipak koristite negdje)
    const badgeSettings = document.getElementById("notifikacijaPorukaSettings");

    // Čišćenje prethodnog sadržaja badgeova
    if (badgeHeader) badgeHeader.innerHTML = "";
    if (badgeSettings) badgeSettings.innerHTML = "";
    
    if (trenutniKorisnik && trenutniKorisnik.id) {
        for (const chatKey in privatnePoruke) {
            if (chatKey.includes(trenutniKorisnik.id)) {
                neprocitane += privatnePoruke[chatKey].filter(msg => !msg.isRead && msg.autorId !== trenutniKorisnik.id).length;
            }
        }
    }
    
    if (neprocitane > 0) {
        const badgeContent = `${neprocitane > 9 ? '9+' : neprocitane}`;
        if (badgeHeader) {
            badgeHeader.innerText = badgeContent;
            badgeHeader.style.display = 'flex';
        }
        if (badgeSettings) {
            badgeSettings.innerText = badgeContent;
            badgeSettings.style.display = 'flex';
        }
    } else {
        if (badgeHeader) badgeHeader.style.display = 'none';
        if (badgeSettings) badgeSettings.style.display = 'none';
    }
}


// --- AŽURIRANJE POSTOJEĆE FUNKCIJE ---
// Moramo malo izmijeniti `prikaziEditProfila` da se ispravno vrati na novi profilni meni.
// Pronađite funkciju `prikaziEditProfila` i ZAMIJENITE je s ovom:

async function prikaziEditProfila() {
    if (!trenutniKorisnik || !trenutniKorisnik.id) return;
    
    const trenutniAktivniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz';
    prethodniEkran = trenutniAktivniEkran; // Postavi prethodni ekran

    const editProfilScreen = document.getElementById("editProfil");
    if (editProfilScreen) {
        editProfilScreen.innerHTML = `
            <div class="top-nav-buttons">
                <button class="back-button left-aligned" onclick="zatvoriEkran('editProfil', 'profilMeni')">←</button>
            </div>
            <h2>Uredi profil</h2>
            <p style="text-align:center;">Učitavam profil...</p>
        `;
        swap(prethodniEkran, "editProfil");
    }

    try {
        const response = await authenticatedFetch(`/api/users/${trenutniKorisnik.id}`);
        if (response.ok) {
            const user = await response.json();
            
            if (editProfilScreen) {
                editProfilScreen.innerHTML = `
                    <div class="top-nav-buttons">
                        <button class="back-button left-aligned" onclick="zatvoriEkran('editProfil', 'profilMeni')">←</button>
                    </div>
                    <h2>Uredi profil</h2>
                    <div style="text-align:center;">
                        <img id="previewEditSlike" class="profilna-slika" />
                    </div>
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

                const editSlikaUploadEl = document.getElementById("editSlikaUpload");
                if (editSlikaUploadEl) {
                    editSlikaUploadEl.addEventListener("change", handleEditSlikaUploadChange);
                }
            }
        } else {
            alert("Greška pri dohvaćanju profila.");
            zatvoriEkran('editProfil', 'profilMeni'); 
        }
    } catch (error) {
        console.error("Greška mreže pri dohvaćanju profila:", error);
        alert("Došlo je do greške pri dohvaćanju profila.");
        zatvoriEkran('editProfil', 'profilMeni');
    }
}