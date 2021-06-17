---
---
{% include_relative service-worker-setup.js %}

var intro = document.querySelector('.banner');
var introPlayer = document.querySelector('.banner__video');

var iOS = /iPad|iPhone|iPod/.test(navigator.platform);
if (iOS) {
  intro.style.backgroundImage = 'url("' + introPlayer.poster + '")';
  introPlayer.style.display = 'none';
}
