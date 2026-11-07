/* Shared header and footer. Edit links here once and every page updates. */
(function(){
  var s=document.currentScript, part=s.dataset.part, C=window.MG_CONFIG||{};
  var base=s.src.replace(/assets\/layout\.js.*$/,'');
  var here=location.pathname.split('/').pop()||'index.html';
  var links=[['Buy','buy.html'],['Sell','sell.html'],['Commercial','commercial.html'],['Development','development.html'],['Listings','properties.html'],['Communities','communities.html'],['About','about.html'],['Blog','blog.html']];
  var phone=C.PHONE||'', tel=C.PHONE_TEL||'', email=C.NOTIFY_EMAIL||'';
  if(part==='header'){
    var li=links.map(function(l){return '<li><a href="'+base+l[1]+'"'+(here===l[1]?' aria-current="page"':'')+'>'+l[0]+'</a></li>'}).join('');
    s.insertAdjacentHTML('beforebegin','<header class="site-header"><div class="wrap"><a class="brand" href="'+base+'index.html">'+(C.BUSINESS_NAME||'The Miller Group')+'</a><button class="nav-toggle" aria-expanded="false" aria-controls="nav">Menu</button><nav id="nav" aria-label="Main"><ul>'+li+'<li><a class="btn btn-gold" href="'+base+'contact.html">Get in touch</a></li></ul></nav></div></header>');
    var btn=document.querySelector('.nav-toggle'),nav=document.getElementById('nav');
    btn.addEventListener('click',function(){var o=nav.classList.toggle('open');btn.setAttribute('aria-expanded',String(o))});
    nav.addEventListener('click',function(e){if(e.target.closest('a')){nav.classList.remove('open');btn.setAttribute('aria-expanded','false')}});
  }
  if(part==='footer'){
    s.insertAdjacentHTML('beforebegin','<footer class="site-footer"><div class="wrap"><div class="foot"><div><a class="brand" href="'+base+'index.html">'+(C.BUSINESS_NAME||'The Miller Group')+'</a><p>Homes, commercial space and development across Colorado’s Front Range and Western Slope.</p></div><div><ul><li><a href="'+base+'buy.html">Buy</a></li><li><a href="'+base+'sell.html">Sell</a></li><li><a href="'+base+'home-value.html">What’s my home worth?</a></li><li><a href="'+base+'commercial.html">Commercial</a></li><li><a href="'+base+'development.html">Development</a></li><li><a href="'+base+'testimonials.html">Testimonials</a></li></ul></div><div><ul><li><a href="tel:'+tel+'">'+phone+'</a></li><li><a href="mailto:'+email+'">'+email+'</a></li><li>Denver, Colorado</li><li><a href="'+base+'contact.html">Contact</a></li></ul></div></div><p class="legal">'+(C.LICENSE_TEXT||'')+' Equal Housing Opportunity. © '+new Date().getFullYear()+' '+(C.BUSINESS_NAME||'The Miller Group')+'.<br><a href="'+base+'terms-of-use.html">Terms of use</a> &nbsp;|&nbsp; <a href="'+base+'privacy-policy.html">Privacy policy</a> &nbsp;|&nbsp; <a href="'+base+'accessibility-statement.html">Accessibility</a> &nbsp;|&nbsp; <a href="'+base+'fair-housing-notice.html">Fair housing notice</a> &nbsp;|&nbsp; <a href="'+base+'admin/">Agent login</a></p></div></footer>');
  }
})();
