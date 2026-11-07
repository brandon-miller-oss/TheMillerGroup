/* Shared behavior for every page: lead capture, UTM tracking, analytics, SEO tags, tiny markdown. */
(function(){
  var C = window.MG_CONFIG || {};
  var MG = window.MG = { config: C };
  MG.ready = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
  MG.base = ((document.currentScript && document.currentScript.src) || '').replace(/assets\/site\.js.*$/, '');

  var esc = MG.esc = function(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  };

  /* ---------- Database client (loaded only when needed) ---------- */
  var clientP;
  MG.client = function(){
    if(!MG.ready) return Promise.resolve(null);
    if(!clientP){
      clientP = new Promise(function(res, rej){
        function make(){ res(window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY)); }
        if(window.supabase) return make();
        var sc = document.createElement('script');
        sc.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
        sc.onload = make; sc.onerror = rej;
        document.head.appendChild(sc);
      });
    }
    return clientP;
  };

  /* ---------- UTM and referrer capture ---------- */
  var UTM = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  MG.utm = (function(){
    try{
      var q = new URLSearchParams(location.search);
      var saved = JSON.parse(localStorage.getItem('mg_utm') || '{}');
      var changed = false;
      UTM.forEach(function(k){ if(q.get(k)){ saved[k] = q.get(k).slice(0,200); changed = true; } });
      if(!saved.referrer && document.referrer && document.referrer.indexOf(location.host) < 0){
        saved.referrer = document.referrer.slice(0,300); changed = true;
      }
      if(changed) localStorage.setItem('mg_utm', JSON.stringify(saved));
      return saved;
    }catch(e){ return {}; }
  })();

  /* ---------- Analytics (only if IDs are set) ---------- */
  if(C.GA4_ID){
    var g = document.createElement('script');
    g.async = true; g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(C.GA4_ID);
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date()); window.gtag('config', C.GA4_ID);
  }
  if(C.META_PIXEL_ID){
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', C.META_PIXEL_ID); window.fbq('track', 'PageView');
  }

  /* ---------- SEO: canonical, og:url and local business schema ---------- */
  function ready(fn){ if(document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){
    if(C.SITE_URL && !document.querySelector('meta[name="robots"][content*="noindex"]')){
      var url = C.SITE_URL.replace(/\/$/, '') + location.pathname.replace(/index\.html$/, '') + location.search.replace(/[?&]utm_[^&]*/g,'');
      var link = document.querySelector('link[rel="canonical"]');
      if(!link){ link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
      link.href = url;
      var og = document.querySelector('meta[property="og:url"]');
      if(!og){ og = document.createElement('meta'); og.setAttribute('property','og:url'); document.head.appendChild(og); }
      og.setAttribute('content', url);
    }
    if(!document.getElementById('mg-schema')){
      var data = {
        '@context':'https://schema.org','@type':'RealEstateAgent',
        name: C.BUSINESS_NAME || 'The Miller Group',
        telephone: C.PHONE_TEL || undefined,
        email: C.NOTIFY_EMAIL || undefined,
        url: C.SITE_URL || undefined,
        areaServed: ['Denver','Aurora','Thornton','Boulder','Summit County','Glenwood Springs','Colorado'],
        address:{'@type':'PostalAddress',addressLocality:'Denver',addressRegion:'CO',addressCountry:'US'}
      };
      var sc = document.createElement('script');
      sc.type = 'application/ld+json'; sc.id = 'mg-schema'; sc.textContent = JSON.stringify(data);
      document.head.appendChild(sc);
    }
  });

  /* ---------- Lead submission ---------- */
  MG.submitLead = async function(lead){
    var sb = await MG.client();
    if(!sb) throw new Error('not-configured');
    var row = Object.assign({}, lead, {
      source: location.pathname.replace(/^.*\//,'') || 'index.html',
      utm_source: MG.utm.utm_source || null, utm_medium: MG.utm.utm_medium || null,
      utm_campaign: MG.utm.utm_campaign || null, utm_content: MG.utm.utm_content || null,
      utm_term: MG.utm.utm_term || null, referrer: MG.utm.referrer || null
    });
    var r = await sb.from('leads').insert(row);
    if(r.error) throw r.error;
    if(window.gtag) window.gtag('event', 'generate_lead', { method: lead.landing_slug || row.source });
    if(window.fbq) window.fbq('track', 'Lead');
  };

  // One handler for every form marked data-lead-form (works for forms added later, too)
  document.addEventListener('submit', async function(e){
    var form = e.target.closest ? e.target.closest('form[data-lead-form]') : null;
    if(!form) return;
    e.preventDefault();
    var note = form.querySelector('.form-note');
    var say = function(t){ if(note) note.textContent = t; };
    var fd = new FormData(form);
    if(fd.get('_gotcha')) return;
    var name = (fd.get('name') || '').toString().trim();
    var email = (fd.get('email') || '').toString().trim();
    if(!name || !/^\S+@\S+\.\S+$/.test(email)){ say('Please add your name and a valid email address.'); return; }
    var core = ['name','email','phone','interest','message','address','_gotcha'], extra = {};
    fd.forEach(function(v,k){ if(core.indexOf(k) < 0 && v !== '') extra[k] = v; });
    var lead = {
      name: name, email: email,
      phone: fd.get('phone') || null,
      interest: fd.get('interest') || form.dataset.interest || null,
      message: fd.get('message') || null,
      address: fd.get('address') || null,
      extra: Object.keys(extra).length ? extra : null,
      landing_slug: form.dataset.landing || null
    };
    var btn = form.querySelector('button[type="submit"]');
    if(btn) btn.disabled = true;
    say('Sending...');
    try{
      await MG.submitLead(lead);
      form.reset();
      say(form.dataset.thanks || 'Thanks. We’ll be in touch within one business day.');
      if(form.dataset.redirect && /^(https?:\/\/|\/|[a-z0-9-]+\.html)/i.test(form.dataset.redirect)){
        setTimeout(function(){ location.href = form.dataset.redirect; }, 900);
      }
    }catch(err){
      if(err && err.message === 'not-configured'){
        var body = 'Name: '+name+'\nEmail: '+email+'\nPhone: '+(lead.phone||'')+'\nInterested in: '+(lead.interest||'')+'\nAddress: '+(lead.address||'')+'\n\n'+(lead.message||'');
        location.href = 'mailto:'+(C.NOTIFY_EMAIL||'')+'?subject='+encodeURIComponent('Website inquiry from '+name)+'&body='+encodeURIComponent(body);
        say('Opening your email app. If nothing opens, email us at '+(C.NOTIFY_EMAIL||'')+'.');
      }else{
        say('Something went wrong. Please try again or call '+(C.PHONE||'us')+'.');
      }
    }finally{
      if(btn) btn.disabled = false;
    }
  });

  /* ---------- Tiny markdown (headings, bold, italics, links, lists) ---------- */
  MG.md = function(src){
    var lines = String(src || '').replace(/\r/g,'').split('\n'), html = '', list = null, para = [];
    function inline(t){
      return esc(t)
        .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,'<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,function(m,a,u){
          return /^(https?:|mailto:|tel:|\/|#|\.)/.test(u) ? '<a href="'+u+'">'+a+'</a>' : a;
        });
    }
    function flushPara(){ if(para.length){ html += '<p>'+inline(para.join(' '))+'</p>'; para = []; } }
    function closeList(){ if(list){ html += '</'+list+'>'; list = null; } }
    lines.forEach(function(raw){
      var l = raw.trim(), m;
      if(!l){ flushPara(); closeList(); return; }
      if((m = l.match(/^(#{1,3})\s+(.*)$/))){ flushPara(); closeList(); html += '<h'+(m[1].length+1)+'>'+inline(m[2])+'</h'+(m[1].length+1)+'>'; return; }
      if((m = l.match(/^[-*]\s+(.*)$/))){ flushPara(); if(list !== 'ul'){ closeList(); html += '<ul>'; list = 'ul'; } html += '<li>'+inline(m[1])+'</li>'; return; }
      if((m = l.match(/^\d+\.\s+(.*)$/))){ flushPara(); if(list !== 'ol'){ closeList(); html += '<ol>'; list = 'ol'; } html += '<li>'+inline(m[1])+'</li>'; return; }
      closeList(); para.push(l);
    });
    flushPara(); closeList();
    return html;
  };

  MG.money = function(n){ return n == null || n === '' ? '' : Number(n).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}); };
  MG.setMeta = function(title, desc){
    if(title) document.title = title;
    if(desc){
      var m = document.querySelector('meta[name="description"]');
      if(!m){ m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
      m.content = desc;
    }
  };
})();
