  // ================= Montant en lettres (FCFA) =================
  function nombreEnLettres(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n === 0) return 'zéro';
    const U = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const T = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
    const b100 = (x, fin) => {
      if (x < 20) return U[x];
      if (x < 70) { const t = Math.floor(x / 10), u = x % 10; return T[t] + (u === 1 ? ' et un' : u ? '-' + U[u] : ''); }
      if (x < 80) { const r = x - 60; return 'soixante' + (r === 11 ? ' et onze' : '-' + U[r]); }
      const r = x - 80; return r === 0 ? 'quatre-vingt' + (fin ? 's' : '') : 'quatre-vingt-' + U[r];
    };
    const b1000 = (x, fin) => {
      const c = Math.floor(x / 100), r = x % 100; let o = '';
      if (c > 0) { o = c === 1 ? 'cent' : U[c] + ' cent'; if (r === 0 && c > 1 && fin) o += 's'; }
      if (r > 0) o += (o ? ' ' : '') + b100(r, fin);
      return o;
    };
    const parts = [], bn = Math.floor(n / 1e9), m = Math.floor(n % 1e9 / 1e6), k = Math.floor(n % 1e6 / 1000), r = n % 1000;
    if (bn) parts.push(b1000(bn, true) + ' milliard' + (bn > 1 ? 's' : ''));
    if (m) parts.push(b1000(m, true) + ' million' + (m > 1 ? 's' : ''));
    if (k) parts.push(k === 1 ? 'mille' : b1000(k, false) + ' mille');
    if (r) parts.push(b1000(r, true));
    return parts.join(' ');
  }
  function nombreEnAnglais(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n === 0) return 'zero';
    const U = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const T = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const b100 = (x) => x < 20 ? U[x] : T[Math.floor(x / 10)] + (x % 10 ? '-' + U[x % 10] : '');
    const b1000 = (x) => [Math.floor(x / 100) ? U[Math.floor(x / 100)] + ' hundred' : '', x % 100 ? b100(x % 100) : ''].filter(Boolean).join(' ');
    const parts = [];
    [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand'], [1, '']].forEach(([s, w]) => { const g = Math.floor(n / s) % 1000; if (g) parts.push(b1000(g) + (w ? ' ' + w : '')); });
    return parts.join(' ');
  }
  function nombreEnArabe(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n === 0) return 'صفر';
    const U = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const T = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const H = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
    const b100 = (x) => x < 20 ? U[x] : (x % 10 ? U[x % 10] + ' و' + T[Math.floor(x / 10)] : T[Math.floor(x / 10)]);
    const b1000 = (x) => [H[Math.floor(x / 100)], x % 100 ? b100(x % 100) : ''].filter(Boolean).join(' و');
    const scale = (g, one, two, plural) => { if (g === 1) return one; if (g === 2) return two; const r = g % 100; return b1000(g) + ' ' + (r >= 3 && r <= 10 ? plural : one); };
    const parts = [], bn = Math.floor(n / 1e9) % 1000, m = Math.floor(n / 1e6) % 1000, k = Math.floor(n / 1e3) % 1000, r = n % 1000;
    if (bn) parts.push(scale(bn, 'مليار', 'ملياران', 'مليارات'));
    if (m) parts.push(scale(m, 'مليون', 'مليونان', 'ملايين'));
    if (k) parts.push(scale(k, 'ألف', 'ألفان', 'آلاف'));
    if (r) parts.push(b1000(r));
    return parts.join(' و');
  }
  // Montant en lettres, dans la langue des factures et la devise du commerce
  function montantEnLettres(n, lang) {
    const D = DEVISES[curCode()], v = Math.round(Number(n) || 0);
    lang = lang || invLang();
    if (lang === 'ar') return 'فقط ' + nombreEnArabe(v) + ' ' + D.ar + ' لا غير';
    if (lang === 'en') { const t = nombreEnAnglais(v); return t.charAt(0).toUpperCase() + t.slice(1) + ' ' + (v === 1 ? D.en[0] : D.en[1]); }
    const t = nombreEnLettres(v);
    const de = /^[aeiouy]/i.test(D.fr[1]) ? " d'" : ' de ';
    return t.charAt(0).toUpperCase() + t.slice(1) + (v >= 1e6 && v % 1e6 === 0 ? de + D.fr[1] : v > 1 ? ' ' + D.fr[1] : ' ' + D.fr[0]);
  }
  function fcfaEnLettres(n) { return montantEnLettres(n, 'fr'); }

  // Textes des factures, tickets, devis et bons (français, anglais, arabe)
  const INV_TXT = {
    fr: { facture: 'Facture', devis: 'Devis', bon_commande: 'Bon de commande', bon_livraison: 'Bon de livraison', ticket: 'Ticket', num: 'N°', date: 'Date', client: 'Client', tel: 'Tél', fiscal: 'N° fiscal', vendeur: 'Vendeur',
      ref: 'Référence', des: 'Désignation', qte: 'Quantité', unite: 'Unité', prix: 'Prix', total: 'Total', totalTTC: 'Total TTC', sous: 'Sous-total', remise: 'Remise', ht: 'Montant HT', tva: 'TVA', dontTva: 'Dont TVA',
      paye: 'Payé', reste: 'Reste à payer', avant: (d) => 'avant le ' + d, articles: (n) => n + ' article(s)', nonFiscal: 'Ticket non valable comme facture fiscale', note: 'Note', remarque: 'Remarque',
      lettres: { facture: 'Arrêtée la présente facture à la somme de : ', devis: 'Arrêté le présent devis à la somme de : ', bon_commande: 'Arrêté le présent bon de commande à la somme de : ', ticket: 'Arrêté à la somme de : ' },
      valable: (d) => "Offre valable jusqu'au " + d, sansEng: 'Offre sans engagement', blInfo: 'Marchandises livrées — merci de vérifier la quantité à la réception', bcInfo: 'Commande à préparer / livrer',
      nonPayee: '⚠ NON PAYÉE — reste à payer : ', partiel: (p, r) => '◐ PAYÉE PARTIELLEMENT — payé : ' + p + ' — reste : ' + r, payee: '✓ PAYÉE INTÉGRALEMENT',
      merci: 'Merci pour votre confiance, à bientôt !', sign: 'Signature / cachet', livreur: 'Le livreur / cachet', accord: 'Bon pour accord (client)', recu: 'Reçu en bon état (nom + signature du client)', blCheck: 'Merci de vérifier les quantités à la réception.' },
    en: { facture: 'Invoice', devis: 'Quotation', bon_commande: 'Purchase order', bon_livraison: 'Delivery note', ticket: 'Receipt', num: 'No.', date: 'Date', client: 'Customer', tel: 'Tel', fiscal: 'Tax ID', vendeur: 'Seller',
      ref: 'Reference', des: 'Description', qte: 'Quantity', unite: 'Unit', prix: 'Price', total: 'Total', totalTTC: 'Total incl. VAT', sous: 'Subtotal', remise: 'Discount', ht: 'Amount excl. VAT', tva: 'VAT', dontTva: 'Incl. VAT',
      paye: 'Paid', reste: 'Balance due', avant: (d) => 'before ' + d, articles: (n) => n + ' item(s)', nonFiscal: 'This receipt is not a tax invoice', note: 'Note', remarque: 'Note',
      lettres: { facture: 'This invoice amounts to: ', devis: 'This quotation amounts to: ', bon_commande: 'This purchase order amounts to: ', ticket: 'Amount in words: ' },
      valable: (d) => 'Offer valid until ' + d, sansEng: 'Non-binding offer', blInfo: 'Goods delivered — please check the quantities on receipt', bcInfo: 'Order to prepare / deliver',
      nonPayee: '⚠ UNPAID — balance due: ', partiel: (p, r) => '◐ PARTLY PAID — paid: ' + p + ' — balance: ' + r, payee: '✓ PAID IN FULL',
      merci: 'Thank you for your trust, see you soon!', sign: 'Signature / stamp', livreur: 'Delivered by / stamp', accord: 'Approved by (customer)', recu: 'Received in good condition (customer name + signature)', blCheck: 'Please check the quantities on receipt.' },
    ar: { facture: 'فاتورة', devis: 'عرض سعر', bon_commande: 'طلب شراء', bon_livraison: 'وصل تسليم', ticket: 'إيصال', num: 'رقم', date: 'التاريخ', client: 'الزبون', tel: 'الهاتف', fiscal: 'الرقم الضريبي', vendeur: 'البائع',
      ref: 'المرجع', des: 'البيان', qte: 'الكمية', unite: 'الوحدة', prix: 'السعر', total: 'المجموع', totalTTC: 'المجموع شامل الضريبة', sous: 'المجموع الفرعي', remise: 'الخصم', ht: 'المبلغ دون الضريبة', tva: 'ضريبة القيمة المضافة', dontTva: 'منها ضريبة القيمة المضافة',
      paye: 'المدفوع', reste: 'المتبقي للدفع', avant: (d) => 'قبل ' + d, articles: (n) => 'عدد القطع: ' + n, nonFiscal: 'هذا الإيصال ليس فاتورة ضريبية', note: 'ملاحظة', remarque: 'ملاحظة',
      lettres: { facture: 'المبلغ بالحروف: ', devis: 'المبلغ بالحروف: ', bon_commande: 'المبلغ بالحروف: ', ticket: 'المبلغ بالحروف: ' },
      valable: (d) => 'العرض صالح حتى ' + d, sansEng: 'عرض دون التزام', blInfo: 'تم تسليم البضاعة — يرجى التحقق من الكميات عند الاستلام', bcInfo: 'طلبية للتحضير / التسليم',
      nonPayee: '⚠ غير مدفوعة — المتبقي: ', partiel: (p, r) => '◐ مدفوعة جزئياً — المدفوع: ' + p + ' — المتبقي: ' + r, payee: '✓ مدفوعة بالكامل',
      merci: 'شكراً لثقتكم، إلى اللقاء!', sign: 'التوقيع / الختم', livreur: 'المُسلِّم / الختم', accord: 'موافقة الزبون', recu: 'استُلمت في حالة جيدة (اسم وتوقيع الزبون)', blCheck: 'يرجى التحقق من الكميات عند الاستلام.' },
  };
  function invT(lang) { return INV_TXT[lang] || INV_TXT.fr; }
  // En arabe (écriture de droite à gauche), on isole les nombres pour qu'ils restent dans le bon ordre
  const bidiIso = (s, lang) => (lang === 'ar' ? '⁦' + s + '⁩' : s);
  const invNum = (n, lang) => bidiIso(Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/[  ]/g, ' '), lang);
  const invMoney = (n, lang) => bidiIso(Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' ' + curSym(), lang);
  const frDate = (d) => String(d || '').split('-').reverse().join('/');

  // Ticket en texte (WhatsApp)
  function ticketText(inv) {
    const c = state.commerce || {};
    const num = 'FAC-' + String(inv.num).padStart(4, '0');
    const dt = inv.createdAt ? new Date(inv.createdAt) : new Date();
    const dateTxt = (inv.date ? inv.date.split('-').reverse().join('/') : dt.toLocaleDateString('fr-FR')) + ' ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const n0 = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
    const L = [];
    const lg = invLang(), X = invT(lg), sp = lg === 'fr' ? ' : ' : ': ', m0 = (n) => invMoney(n, lg);
    const nn = (n) => invNum(n, lg);
    L.push('🧾 *' + (c.nom || 'BoromBoutik') + '*');
    if (c.adresse) L.push(c.adresse);
    if (c.telephone) L.push(X.tel + sp + bidiIso(c.telephone, lg));
    L.push('─────────────');
    L.push(X.ticket + ' ' + bidiIso(num, lg) + ' — ' + bidiIso(dateTxt, lg));
    if (inv.client) L.push(X.client + sp + inv.client);
    L.push('─────────────');
    (inv.lignes || []).forEach(l => {
      const q = Number(l.qte) || 0, pr = Number(l.prix) || 0;
      L.push('• ' + l.nom + '\n   ' + bidiIso(q + (l.unite ? ' ' + l.unite : '') + ' × ' + n0(pr) + ' = ' + n0(q * pr), lg));
    });
    L.push('─────────────');
    const rem = Number(inv.remise) || 0, tm = inv.tvaMode || 'none', tv = Number(inv.tvaMontant) || 0, tx = Number(inv.tvaTaux) || 0;
    if (rem > 0) L.push(X.remise + sp + bidiIso('- ' + n0(rem), lg));
    if (tm === 'add') L.push(X.tva + ' ' + bidiIso(tx + '%', lg) + sp + bidiIso('+ ' + n0(tv), lg)); else if (tm === 'incl') L.push(X.dontTva + ' ' + bidiIso(tx + '%', lg) + sp + nn(tv));
    const total = Number(inv.total) || 0, paye = Number(inv.montantPaye) || 0, reste = Math.max(0, total - paye);
    L.push('*' + X.total.toUpperCase() + sp + m0(total) + '*');
    L.push('_' + montantEnLettres(total, lg) + '_');
    L.push(X.paye + sp + m0(paye));
    if (reste > 0) L.push('⚠️ *' + X.reste + sp + m0(reste) + '*' + (inv.echeance ? ' ' + X.avant(bidiIso(frDate(inv.echeance), lg)) : ''));
    if (inv.remarque) L.push('📝 ' + inv.remarque);
    L.push('');
    L.push(c.messageFacture || X.merci);
    return L.join('\n');
  }
  function sendTicketWhatsApp(inv, askIfMissing, text) {
    let cl = inv.clientId ? (state.clients || []).find(x => x.id === inv.clientId) : null;
    if (!cl && inv.client) cl = (state.clients || []).find(x => (x.nom || '').trim().toLowerCase() === String(inv.client).trim().toLowerCase());
    const key = String((cl && cl.id) || inv.client || '').trim().toLowerCase();
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem('sf_wa_phones' + clNs()) || '{}') || {}; } catch (e) {}
    let phone = toWhatsAppNumber(cl && cl.telephone) || (key ? toWhatsAppNumber(cache[key]) : '');
    // Demande le numéro seulement si on connaît le client mais pas son téléphone (1 seule fois, ensuite mémorisé)
    if (!phone && askIfMissing && key) {
      const r = prompt('Numéro WhatsApp de ' + (inv.client || 'ce client') + ' (ex : 77 123 45 67).\nIl sera mémorisé. Laissez vide pour choisir le contact dans WhatsApp :');
      if (r === null) return;
      phone = toWhatsAppNumber(r);
      if (phone) { cache[key] = phone; try { localStorage.setItem('sf_wa_phones' + clNs(), JSON.stringify(cache)); } catch (e) {} }
    }
    const url = (phone ? 'https://wa.me/' + phone : 'https://wa.me/') + '?text=' + encodeURIComponent(text || ticketText(inv));
    const win = window.open(url, 'sf_whatsapp');   // même onglet réutilisé à chaque envoi
    if (!win) toast('⚠ Le navigateur a bloqué WhatsApp : allez dans Factures > bouton 💬 WhatsApp.');
  }

  function printTicket(inv) {
    const w = (document.getElementById('tkWidth') && document.getElementById('tkWidth').value === '58') ? 58 : 80;
    const c = state.commerce || {};
    const num = 'FAC-' + String(inv.num).padStart(4, '0');
    const dt = inv.createdAt ? new Date(inv.createdAt) : new Date();
    const dateTxt = (inv.date ? inv.date.split('-').reverse().join('/') : dt.toLocaleDateString('fr-FR')) + ' ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const lg = invLang(), X = invT(lg), sp = lg === 'fr' ? ' : ' : ': ';
    const num0 = (n) => invNum(n, lg), iso = (s) => bidiIso(s, lg);
    const lignes = (inv.lignes || []).map(l => {
      const q = Number(l.qte) || 0, pr = Number(l.prix) || 0;
      return `<div class="tk-item"><div class="tk-name">${escapeHtml(l.nom)}</div><div class="tk-row"><span>${iso(escapeHtml(String(q)) + (l.unite ? ' ' + escapeHtml(l.unite) : '') + ' × ' + num0(pr))}</span><span>${num0(q * pr)}</span></div></div>`;
    }).join('');
    const rem = Number(inv.remise) || 0, tm = inv.tvaMode || 'none', tv = Number(inv.tvaMontant) || 0, tx = Number(inv.tvaTaux) || 0;
    const sub = Number(inv.sousTotal) || (inv.lignes || []).reduce((t, l) => t + (Number(l.prix) || 0) * (Number(l.qte) || 0), 0);
    const extra = [];
    if (rem > 0 || tm !== 'none') {
      extra.push([X.sous, num0(sub)]);
      if (rem > 0) extra.push([X.remise, iso('- ' + num0(rem))]);
      if (tm === 'add') { extra.push([X.ht, num0(sub - rem)]); extra.push([X.tva + ' ' + iso(tx + '%'), iso('+ ' + num0(tv))]); }
      else if (tm === 'incl') extra.push([X.dontTva + ' ' + iso(tx + '%'), num0(tv)]);
    }
    const paye = Number(inv.montantPaye) || 0, total = Number(inv.total) || 0, reste = Math.max(0, total - paye);
    const logo = isImageData(c.logoUrl) ? `<img class="tk-logo" src="${c.logoUrl}" alt="">` : '';
    const nbArt = (inv.lignes || []).reduce((t, l) => t + (Number(l.qte) || 0), 0);
    document.getElementById('printTicket').innerHTML = `
      <div class="tk-center">${logo}<div class="tk-shop">${escapeHtml(c.nom || 'BoromBoutik')}</div>
        ${c.adresse ? `<div>${escapeHtml(c.adresse)}</div>` : ''}${c.telephone ? `<div>${X.tel}${sp}${iso(escapeHtml(c.telephone))}</div>` : ''}${c.numeroFiscal ? `<div>${X.fiscal}${sp}${iso(escapeHtml(c.numeroFiscal))}</div>` : ''}</div>
      <div class="tk-sep"></div>
      <div class="tk-row"><span>${X.ticket} ${iso(num)}</span><span>${iso(escapeHtml(dateTxt))}</span></div>
      ${inv.operateur ? `<div>${X.vendeur}${sp}${escapeHtml(String(inv.operateur).replace(/\s*\(.*\)$/, ''))}</div>` : ''}
      ${inv.client ? `<div>${X.client}${sp}${escapeHtml(inv.client)}</div>` : ''}
      <div class="tk-sep"></div>
      ${lignes}
      <div class="tk-sep"></div>
      ${extra.map(r => `<div class="tk-row"><span>${escapeHtml(r[0])}</span><span>${escapeHtml(r[1])}</span></div>`).join('')}
      <div class="tk-row tk-total"><span>${X.total.toUpperCase()}</span><span>${invMoney(total, lg)}</span></div>
      <div class="tk-row"><span>${X.paye}</span><span>${num0(paye)}</span></div>
      ${reste > 0 ? `<div class="tk-row tk-reste"><span>${X.reste.toUpperCase()}</span><span>${num0(reste)}</span></div>` : ''}
      ${reste > 0 && inv.echeance ? `<div class="tk-small">${X.reste} ${escapeHtml(X.avant(iso(frDate(inv.echeance))))}</div>` : ''}
      <div class="tk-small">${escapeHtml(X.articles(iso(String(nbArt))))}</div>
      <div class="tk-small">${X.lettres.ticket}${escapeHtml(montantEnLettres(total, lg))}</div>
      ${inv.remarque ? `<div class="tk-small">${X.note}${sp}${escapeHtml(inv.remarque)}</div>` : ''}
      <div class="tk-sep"></div>
      <div class="tk-center tk-thanks">${escapeHtml(c.messageFacture || X.merci)}</div>
      <div class="tk-center tk-small">${X.nonFiscal}</div>
      <div class="tk-cut">.</div>`;
    const pt = document.getElementById('printTicket');
    pt.className = 'tk-w' + w;
    pt.dir = lg === 'ar' ? 'rtl' : 'ltr';
    const page = document.createElement('style'); page.id = 'ticket-page';
    page.textContent = `@page { size: ${w}mm auto; margin: 0; }`;
    document.head.appendChild(page);
    document.body.classList.add('print-ticket');
    const cleanup = () => { document.body.classList.remove('print-ticket'); const x = document.getElementById('ticket-page'); if (x) x.remove(); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 350);
  }

  function printInvoice(inv, kind) {
    kind = kind || 'facture';
    const isBL = kind === 'bon_livraison';
    const lg = invLang(), X = invT(lg), sp = lg === 'fr' ? ' : ' : ': ', iso = (s) => bidiIso(s, lg), mny = (n) => invMoney(n, lg);
    const pa = document.getElementById('printArea');
    pa.classList.toggle('pi-bl', isBL);
    pa.dir = lg === 'ar' ? 'rtl' : 'ltr'; pa.lang = lg;
    ['ref', 'des', 'qte', 'unite', 'prix', 'total'].forEach((k, i) => { const th = pa.querySelectorAll('.pi-table thead th')[i]; if (th) th.textContent = X[k]; });
    document.getElementById('pi-client-lbl').textContent = X.client + sp;
    document.getElementById('pi-client-sign-label').textContent = isBL ? X.recu : X.accord;
    document.getElementById('pi-signature-label').textContent = isBL ? X.livreur : X.sign;
    document.getElementById('pi-title').textContent = X[kind] || X.facture;
    document.getElementById('pi-client-sign').style.display = kind === 'facture' ? 'none' : '';
    const numPrefix = kind === 'devis' ? 'DEV' : (kind === 'bon_commande' ? 'BC' : (isBL ? 'BL' : 'FAC'));
    document.getElementById('pi-num').textContent = X.num + ' ' + iso(numPrefix + '-' + String(inv.num).padStart(4, '0'));
    document.getElementById('pi-date').textContent = inv.date ? X.date + sp + iso(frDate(inv.date)) : '';
    document.getElementById('pi-commerce-nom').textContent = (state.commerce && state.commerce.nom) || 'BoromBoutik';
    document.getElementById('pi-commerce-adresse').textContent = state.commerce ? [state.commerce.adresse, state.commerce.telephone && iso(state.commerce.telephone), state.commerce.numeroFiscal && (X.fiscal + sp + iso(state.commerce.numeroFiscal))].filter(Boolean).join(' · ') : '';
    document.getElementById('pi-client').textContent = inv.client || '—';
    // Logo, message de remerciement et signature (réglés dans Données > Mon commerce)
    const logoEl = document.getElementById('pi-logo');
    const logoSrc = state.commerce && state.commerce.logoUrl;
    if (isImageData(logoSrc)) { logoEl.src = logoSrc; logoEl.style.display = ''; } else { logoEl.removeAttribute('src'); logoEl.style.display = 'none'; }
    const sigEl = document.getElementById('pi-signature');
    const sigSrc = state.commerce && state.commerce.signatureUrl;
    if (isImageData(sigSrc)) { sigEl.src = sigSrc; document.getElementById('pi-signature-box').style.display = ''; } else { sigEl.removeAttribute('src'); document.getElementById('pi-signature-box').style.display = 'none'; }
    document.getElementById('pi-message').textContent = (state.commerce && state.commerce.messageFacture) || X.merci;
    fstyleApply(pa, lg);   // modèle, couleur, RCCM, numéros Wave / Orange Money (19a-modeles-facture.js)
    document.getElementById('pi-lines').innerHTML = (inv.lignes || []).map(l => `
      <tr><td>${escapeHtml(l.ref || '—')}</td><td>${escapeHtml(l.nom)}</td><td class="num-cell">${iso(escapeHtml(String(l.qte)))}</td><td>${escapeHtml(l.unite || '')}</td><td class="num-cell">${mny(l.prix)}</td><td class="num-cell">${mny((Number(l.prix) || 0) * (Number(l.qte) || 0))}</td></tr>
    `).join('');
    {
      const rem = Number(inv.remise) || 0, tm = inv.tvaMode || 'none', tv = Number(inv.tvaMontant) || 0, tx = Number(inv.tvaTaux) || 0;
      const rows = [];
      if (kind !== 'bon_livraison' && (rem > 0 || tm !== 'none')) {
        const sub = Number(inv.sousTotal) || (inv.lignes || []).reduce((s, l) => s + (Number(l.prix) || 0) * (Number(l.qte) || 0), 0);
        rows.push([X.sous, mny(sub)]);
        if (rem > 0) rows.push([X.remise, iso('− ' + mny(rem))]);
        if (tm === 'add') { rows.push([X.ht, mny(sub - rem)]); rows.push([X.tva + ' ' + iso('(' + tx + ' %)'), iso('+ ' + mny(tv))]); }
        else if (tm === 'incl') rows.push([X.dontTva + ' ' + iso('(' + tx + ' %)'), mny(tv)]);
      }
      document.getElementById('pi-breakdown').innerHTML = rows.map(r => `<div><span>${escapeHtml(r[0])}</span><span>${escapeHtml(r[1])}</span></div>`).join('');
      document.getElementById('pi-total-lbl').textContent = (kind !== 'bon_livraison' && tm !== 'none') ? X.totalTTC : X.total;
    }
    document.getElementById('pi-total').textContent = mny(inv.total);
    {
      const lt = document.getElementById('pi-lettres');
      lt.textContent = isBL ? '' : (X.lettres[kind] || X.lettres.facture) + montantEnLettres(inv.total, lg);
      const rm = document.getElementById('pi-remarque');
      if (inv.remarque) { rm.style.display = ''; rm.textContent = X.remarque + sp + inv.remarque; } else { rm.style.display = 'none'; rm.textContent = ''; }
    }
    const paye = Number(inv.montantPaye) || 0;
    const reste = Math.max(0, Number(inv.total || 0) - paye);
    const statutEl = document.getElementById('pi-statut');
    const ech = inv.echeance ? ' ' + X.avant(iso(frDate(inv.echeance))) : '';
    if (kind !== 'facture') {
      statutEl.textContent = kind === 'devis' ? (inv.validite ? X.valable(iso(frDate(inv.validite))) : X.sansEng) : (isBL ? X.blInfo : X.bcInfo);
      statutEl.style.background = '#e0e7ff'; statutEl.style.color = '#3730a3';
    } else if (paye <= 0) {
      statutEl.textContent = X.nonPayee + mny(reste) + ech;
      statutEl.style.background = '#fee2e2'; statutEl.style.color = '#991b1b';
    } else if (reste > 0) {
      statutEl.textContent = X.partiel(mny(paye), mny(reste)) + ech;
      statutEl.style.background = '#fef3c7'; statutEl.style.color = '#92400e';
    } else {
      statutEl.textContent = X.payee;
      statutEl.style.background = '#dcfce7'; statutEl.style.color = '#166534';
    }
    if (isBL) document.getElementById('pi-signature-box').style.display = '';
    setTimeout(() => window.print(), 350);
  }

