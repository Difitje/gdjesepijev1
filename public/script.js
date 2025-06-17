// ===================================================================
// FINALNI STABILNI SCRIPT.JS
// ===================================================================

// --- Globalne varijale ---
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

// --- Glavni događaj za učitavanje aplikacije ---
window.addEventListener('DOMContentLoaded', async () => {
    poveziListenere();

    const token = localStorage.getItem("token");
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
            console.error("Greška pri provjeri tokena (server možda nije pokrenut):", error);
            localStorage.removeItem("token");
        }
    }

    const splashScreen = document.getElementById('splashScreen');
    setTimeout(() => {
        if (splashScreen) splashScreen.classList.add('hidden');
        document.getElementById('pageWrapper').style.display = 'block';

        if (appInitializedSuccessfully) {
            pokreniAplikaciju();
        } else {
            swap(null, 'intro');
        }
    }, 1500);
});


function poveziListenere() {
    document.getElementById('profilIcon').addEventListener('click', () => {
        const aktivniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz';
        prethodniEkran = aktivniEkran;
        swap(aktivniEkran, 'profilMeni');
    });
    document.getElementById('porukeIcon').addEventListener('click', () => prikaziInbox());
    document.getElementById('novaObjavaBtn').addEventListener('click', () => pokaziObjavu());
    document.getElementById("slikaUpload").addEventListener("change", function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = e => {
                odabranaSlika = e.target.result;
                const previewElement = document.getElementById("previewSlikes");
                previewElement.src = odabranaSlika;
                previewElement.style.display = "block";
            };
            reader.readAsDataURL(file);
        }
    });
    document.getElementById("privatniInput").addEventListener("input", function() {
        this.style.height = "auto";
        this.style.height = (this.scrollHeight) + "px";
    });
}

function swap(hideId, showId) {
    if (hideId) {
        const hideElement = document.getElementById(hideId);
        if (hideElement) hideElement.classList.remove('active-screen');
    }
    const showElement = document.getElementById(showId);
    if (showElement) {
        showElement.classList.add('active-screen');
        showElement.scrollTop = 0;
    }
}

function zatvoriEkran(trenutniEkranId, povratniEkranId) {
    swap(trenutniEkranId, povratniEkranId);
    if (trenutniEkranId === 'privatniChat' && chatStatusInterval) {
        clearInterval(chatStatusInterval);
    }
}

function pokreniAplikaciju() {
    document.getElementById('noviHeader').style.display = 'flex';
    document.getElementById('noviFooter').style.display = 'flex';
    swap(document.querySelector('.container.active-screen')?.id, 'lokacijePrikaz');
    activityInterval = setInterval(azurirajMojuAktivnost, 15000);
    globalDataRefreshInterval = setInterval(globalRefreshUI, 30000);
    azurirajMojuAktivnost();
    dohvatiLokaciju(() => {
        prikaziPijankePregled();
        azurirajNotifikacije();
    });
}

async function odjaviSe() {
    document.getElementById('noviHeader').style.display = 'none';
    document.getElementById('noviFooter').style.display = 'none';
    [activityInterval, chatStatusInterval, globalDataRefreshInterval].forEach(i => i && clearInterval(i));
    if (trenutniKorisnik) await azurirajMojuAktivnost(true);
    localStorage.removeItem("token");
    trenutniKorisnik = null;
    const aktivniEkran = document.querySelector('.container.active-screen');
    swap(aktivniEkran ? aktivniEkran.id : null, 'intro');
}

async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    if (token) {
        options.headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
    }
    return fetch(url, options);
}

function proveriPrihvatanje() {
    document.getElementById('nastaviBtn').disabled = !document.getElementById('prihvatamPravila').checked;
}

async function globalRefreshUI() {
    if (!trenutniKorisnik) return;
    await Promise.all([dohvatiSveKorisnike(),dohvatiSvePijanke(),dohvatiSvePoruke()]);
    if (document.getElementById("lokacijePrikaz")?.classList.contains('active-screen')) prikaziPijankePregled();
    if (document.getElementById("inboxPrikaz")?.classList.contains('active-screen')) prikaziInbox();
    if (document.getElementById("privatniChat")?.classList.contains('active-screen') && trenutniChatPartnerId) prikaziPrivatniLog();
    azurirajNotifikacije();
}

function handleEditSlikaUploadChange() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            odabranaEditSlika = e.target.result;
            document.getElementById("previewEditSlike").src = odabranaEditSlika;
        };
        reader.readAsDataURL(file);
    }
}

async function registruj() {
    const ime = document.getElementById("ime").value.trim();
    const sifra = document.getElementById("sifra").value.trim();
    if (!ime || !sifra || !odabranaSlika) return alert("Ime, šifra i slika su obavezni!");
    const btn = document.getElementById('registracijaSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Registracija...';
    try {
        const compressedSlika = await compressImage(odabranaSlika);
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: ime, password: sifra, slika: compressedSlika,
                instagram: document.getElementById("instagram").value.trim(),
                tiktok: document.getElementById("tiktok").value.trim(),
                opis: document.getElementById("opis").value.trim()
            })
        });
        const data = await response.json();
        if (response.ok) await ulogujSe(ime, sifra);
        else alert("Greška: " + data.message);
    } catch (e) {
        alert("Greška kod registracije.");
    } finally {
        btn.disabled = false;
        btn.textContent = 'Spremi';
    }
}

async function ulogujSe(usernameFromRegister = null, passwordFromRegister = null) {
    const ime = usernameFromRegister || document.getElementById("loginIme").value.trim();
    const sifra = passwordFromRegister || document.getElementById("loginSifra").value.trim();
    if (!ime || !sifra) return alert("Unesite ime i šifru!");
    const btn = document.getElementById('loginSubmitBtn');
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
            await Promise.all([dohvatiSveKorisnike(),dohvatiSvePijanke(),dohvatiSvePoruke()]);
            pokreniAplikaciju();
        } else {
            alert("Greška: " + data.message);
        }
    } catch (e) {
        alert("Greška kod prijave.");
    } finally {
        btn.disabled = false;
        btn.textContent = 'Prijavi se';
    }
}

async function prikaziEditProfila() {
    if (!trenutniKorisnik) return;
    const aktivniEkran = document.querySelector('.container.active-screen')?.id;
    swap(aktivniEkran, 'editProfil');
    const editContainer = document.getElementById("editProfil");
    editContainer.innerHTML = `<p>Učitavam...</p>`;
    try {
        const response = await authenticatedFetch(`/api/users/${trenutniKorisnik.id}`);
        if (!response.ok) throw new Error();
        const user = await response.json();
        editContainer.innerHTML = `
            <button class="back-button" onclick="zatvoriEkran('editProfil', 'profilMeni')"><i class="fas fa-arrow-left"></i></button>
            <h2 style="margin-bottom: 10px;">Uredi profil</h2>
            <img id="previewEditSlike" class="preview-slika" style="display:block; width:90px; height:90px;"/>
            <input id="editIme" placeholder="Korisničko ime" />
            <textarea id="editOpis" placeholder="O meni..." rows="3"></textarea>
            <input id="editInstagram" placeholder="Instagram" />
            <input id="editTiktok" placeholder="TikTok" />
            <label>Promijeni sliku:</label>
            <input type="file" id="editSlikaUpload" accept="image/*" />
            <button id="sacuvajProfilBtn" onclick="sacuvajProfil()">Spremi promjene</button>`;
        document.getElementById("editIme").value = user.ime || '';
        document.getElementById("editOpis").value = user.opis || '';
        document.getElementById("editInstagram").value = user.instagram || '';
        document.getElementById("editTiktok").value = user.tiktok || '';
        document.getElementById("previewEditSlike").src = user.slika || 'default_profile.png';
        document.getElementById("editSlikaUpload").addEventListener("change", handleEditSlikaUploadChange);
    } catch (e) {
        alert("Greška pri učitavanju profila.");
        zatvoriEkran('editProfil', 'profilMeni');
    }
}

async function sacuvajProfil() {
    if (!document.getElementById("editIme").value.trim()) return alert("Ime je obavezno!");
    const btn = document.getElementById('sacuvajProfilBtn');
    btn.disabled = true; btn.textContent = 'Spremam...';
    try {
        const updateData = {
            username: document.getElementById("editIme").value.trim(),
            opis: document.getElementById("editOpis").value.trim(),
            instagram: document.getElementById("editInstagram").value.trim(),
            tiktok: document.getElementById("editTiktok").value.trim()
        };
        if (odabranaEditSlika) {
            updateData.slika = await compressImage(odabranaEditSlika);
        }
        const response = await authenticatedFetch(`/api/users/${trenutniKorisnik.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateData) });
        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            await globalRefreshUI();
            zatvoriEkran("editProfil", 'profilMeni');
        } else { alert("Greška: " + data.message); }
    } catch(e) {
        alert("Greška kod spremanja.");
    } finally {
        btn.disabled = false; btn.textContent = 'Spremi promjene';
    }
}

async function azurirajMojuAktivnost(loggingOut = false) {
    if (!trenutniKorisnik) return;
    try { await authenticatedFetch(`/api/users/${trenutniKorisnik.id}/activity`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loggingOut }) }); }
    catch (e) { console.error("Aktivnost nije ažurirana", e); }
}

function formatirajStatus(isoTimestamp) {
    if (!isoTimestamp) return { text: "Offline", online: false };
    const diff = Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 1000);
    if (diff < 30) return { text: "Online", online: true };
    if (diff < 60) return { text: "prije minutu", online: false };
    if (diff < 3600) return { text: `prije ${Math.round(diff/60)} min`, online: false };
    if (diff < 86400) return { text: `prije ${Math.round(diff/3600)} h`, online: false };
    return { text: `prije ${Math.round(diff/86400)} dana`, online: false };
}

function dohvatiLokaciju(callback) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            mojPoz = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            if(callback) callback();
        }, () => {
            alert("Lokacija je potrebna.");
            if(callback) callback();
        });
    } else if(callback) callback();
}

function distKM(p1, p2) {
    if (!p1 || !p2) return "?";
    const R=6371, dLat=(p2.lat-p1.lat)*Math.PI/180, dLon=(p2.lon-p1.lon)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(p1.lat*Math.PI/180)*Math.cos(p2.lat*Math.PI/180)*Math.sin(dLon/2)**2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
}

function pokaziObjavu() {
    prethodniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz';
    swap(prethodniEkran, "glavniDio");
    document.getElementById('glavniDioNaslov').innerText = "Objavi pijanku";
    document.getElementById("objavaForma").style.display = "block";
    document.getElementById("profilKorisnika").style.display = "none";
}

async function objaviPijanku() {
    const opis = document.getElementById("opisPijanke").value.trim();
    if (!opis) return alert("Opiši pijanku!");
    if (!mojPoz) return dohvatiLokaciju(() => objaviPijanku());
    const btn = document.querySelector('#objavaForma button');
    btn.disabled = true;
    try {
        const response = await authenticatedFetch('/api/posts', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ opis, lat: mojPoz.lat, lon: mojPoz.lon }) });
        if (response.ok) {
            await dohvatiSvePijanke();
            zatvoriEkran("glavniDio", "lokacijePrikaz");
            prikaziPijankePregled();
        } else { const data = await response.json(); alert("Greška: " + data.message); }
    } catch(e){ alert("Greška kod objave."); }
    finally { btn.disabled = false; }
}

async function obrisiPijanku(pijankaId, event) {
    event.stopPropagation();
    if (!confirm("Obrisati objavu?")) return;
    try {
        const response = await authenticatedFetch(`/api/posts?postId=${pijankaId}`, { method: 'DELETE' });
        if (response.ok) {
            await dohvatiSvePijanke();
            prikaziPijankePregled();
        } else { alert("Greška pri brisanju."); }
    } catch(e) { alert("Greška kod brisanja."); }
}

function prikaziPijankePregled() {
    const div = document.getElementById("pijankePregled");
    if (!div) return;
    div.innerHTML = "";
    if (svePijanke.length === 0) {
        div.innerHTML = '<p style="text-align:center; padding: 50px 20px;">Trenutno nitko ne pije. Budi prvi!</p>';
        return;
    }
    svePijanke.forEach(pijanka => {
        const autor = sviKorisnici.find(u => u.id === pijanka.korisnikId);
        if (!autor) return;
        const status = formatirajStatus(autor.lastActive);
        const kartica = document.createElement('div');
        kartica.className = 'pijanka';
        kartica.innerHTML = `
            <div class="pijanka-header" onclick="otvoriProfil('${autor.id}')">
                <img src="${autor.slika || 'default_profile.png'}" alt="Profilna" class="pijanka-profilna-slika">
                <div class="pijanka-info">
                    <strong>${autor.ime}</strong>
                    <p class="status-text"><span class="status-dot ${status.online ? "online" : "offline"}"></span>${status.online ? 'Online' : distKM(mojPoz, pijanka) + 'km od tebe'}</p>
                </div>
                ${trenutniKorisnik && autor.id === trenutniKorisnik.id ? `<button class="delete-btn"><i class="fas fa-trash"></i></button>` : ""}
            </div>
            <div class="pijanka-opis"><p>${pijanka.opis}</p></div>`;
        if(trenutniKorisnik && autor.id === trenutniKorisnik.id){
            kartica.querySelector('.delete-btn').onclick = (e) => obrisiPijanku(pijanka.id, e);
        }
        div.appendChild(kartica);
    });
}

async function otvoriProfil(korisnikId) {
    prethodniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz';
    swap(prethodniEkran, "glavniDio");
    const naslov = document.getElementById("glavniDioNaslov");
    const forma = document.getElementById("objavaForma");
    const profilDiv = document.getElementById("profilKorisnika");
    
    naslov.innerText = "Profil korisnika";
    forma.style.display = 'none';
    profilDiv.style.display = 'block';
    profilDiv.innerHTML = `<p>Učitavam...</p>`;

    try {
        const response = await authenticatedFetch(`/api/users/${korisnikId}`);
        if (!response.ok) throw new Error("Korisnik nije pronađen");
        const korisnik = await response.json();
        profilDiv.innerHTML = `
            <img src="${korisnik.slika||'default_profile.png'}" alt="Profilna">
            <h2>${korisnik.ime}</h2>
            <p>${korisnik.opis || "Nema opisa."}</p>
            <div style="margin:20px 0;">${prikaziMreze(korisnik)}</div>
            ${trenutniKorisnik && korisnik.id !== trenutniKorisnik.id ? `<button onclick="pokreniPrivatniChat('${korisnik.id}', 'glavniDio')">💬 Pošalji poruku</button>` : ''}`;
    } catch (e) {
        alert(e.message);
        zatvoriEkran('glavniDio', prethodniEkran);
    }
}

function prikaziMreze(p) {
    let s = "";
    if (p.instagram) s += `<a href="https://instagram.com/${p.instagram}" target="_blank" class="header-icon"><i class="fab fa-instagram"></i></a>`;
    if (p.tiktok) s += `<a href="https://tiktok.com/@${p.tiktok}" target="_blank" class="header-icon"><i class="fab fa-tiktok"></i></a>`;
    return s ? `<div style="display:flex; justify-content:center; gap:15px;">${s}</div>` : '';
}

function azurirajNotifikacije() {
    let neprocitane = 0;
    const badge = document.getElementById("notifikacijaPorukaHeader");
    if (trenutniKorisnik) {
        for (const key in privatnePoruke) {
            if (key.includes(trenutniKorisnik.id)) {
                neprocitane += privatnePoruke[key].filter(msg => !msg.isRead && msg.autorId !== trenutniKorisnik.id).length;
            }
        }
    }
    if (badge) {
        if (neprocitane > 0) {
            badge.innerText = `${neprocitane > 9 ? '9+' : neprocitane}`;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

async function prikaziInbox() {
    prethodniEkran = document.querySelector('.container.active-screen')?.id || 'lokacijePrikaz';
    swap(prethodniEkran, "inboxPrikaz");
    const div = document.getElementById("listaChatova");
    div.innerHTML = "";
    const chatKeys = trenutniKorisnik ? Object.keys(privatnePoruke).filter(key => key.includes(trenutniKorisnik.id)) : [];
    if (chatKeys.length === 0) {
        div.innerHTML = '<p style="text-align:center;color:#888;">Nemaš još nijednu poruku.</p>';
        return;
    }
    chatKeys.sort((a,b) => new Date(privatnePoruke[b].slice(-1)[0]?.time) - new Date(privatnePoruke[a].slice(-1)[0]?.time))
    .forEach(key => {
        const partnerId = key.split("-").find(id => id !== trenutniKorisnik.id);
        const partner = sviKorisnici.find(u => u.id == partnerId);
        if (!partner) return;
        const neprocitane = privatnePoruke[key].some(m => !m.isRead && m.autorId == partner.id);
        div.innerHTML += `
            <div class="chat-item" onclick="pokreniPrivatniChat('${partner.id}', 'inboxPrikaz')">
                <img src="${partner.slika || 'default_profile.png'}" alt="profilna">
                <div class="chat-item-info">
                    <strong>${partner.ime}</strong>
                    <p class="status-text">${formatirajStatus(partner.lastActive).text}</p>
                </div>
                ${neprocitane ? '<span class="notification-badge-header" style="display:flex; position:static; height:12px; min-width:12px; background: var(--primary-color);"></span>' : ''}
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
    await authenticatedFetch('/api/messages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatKey }) });
    await dohvatiSvePoruke();
    azurirajNotifikacije();
    if(chatStatusInterval) clearInterval(chatStatusInterval);
    const updateStatus = () => {
        const svezPartner = sviKorisnici.find(u => u.id === partnerId);
        if(svezPartner) document.getElementById("chatPartnerStatus").innerText = formatirajStatus(svezPartner.lastActive).text;
    };
    chatStatusInterval = setInterval(updateStatus, 5000);
    updateStatus();
    swap(saEkrana, "privatniChat");
    prikaziPrivatniLog();
}

async function posaljiPrivatno() {
    const input = document.getElementById("privatniInput")
    const tekst = input.value.trim();
    if (!tekst) return;
    const btn = document.getElementById('posaljiPrivatnoBtn');
    btn.disabled = true;
    try {
        await authenticatedFetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receiverId: trenutniChatPartnerId, content: tekst }) });
        input.value = "";
        input.style.height = "auto";
        await dohvatiSvePoruke();
        prikaziPrivatniLog();
    } catch (e) { alert("Greška pri slanju."); }
    finally { btn.disabled = false; }
}

function prikaziPrivatniLog() {
    if (!trenutniKorisnik) return;
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

async function compressImage(base64Image, maxWidth = 400, quality = 0.8) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Image;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            if (width > maxWidth) {
                height *= maxWidth / width;
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