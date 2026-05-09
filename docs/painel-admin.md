

<!doctype html>

<html lang="en-US" class="h-full">

&#x20; <head>

&#x20;   <meta charset="utf-8">

&#x20;   <meta http-equiv="X-UA-Compatible" content="IE=edge">

&#x20;   <meta name="csrf-token" content="OwAObgAPFg0\_Al04NTcWaz4HUywGDkgGHBa8JfuwKRjMDPD\_TJkAlLp2">



&#x20;   <title data-suffix=" · Fly">Dashboard · Fly</title>



&#x20;   <meta property="og:type" content="website">

&#x20;   <meta property="og:site\_name" content="Fly.io">

&#x20;   <meta property="og:title" content="Dashboard">

&#x20;   <meta property="og:description" content="Build fast. Run any code fearlessly.">

&#x20;   <meta property="og:image" content="https://fly.io/phx/images/preview/og-7ea9380853220ced249aaf88c2332937.jpg?vsn=d">

&#x20;   <meta property="og:image:width" content="1200">

&#x20;   <meta property="og:image:height" content="630">

&#x20;   <meta name="twitter:card" content="summary\_large\_image">

&#x20;   <meta name="twitter:site" content="@flydotio">

&#x20;   <meta name="twitter:title" content="Dashboard">

&#x20;   <meta name="twitter:description" content="Build fast. Run any code fearlessly.">

&#x20;   <meta name="twitter:image" content="https://fly.io/phx/images/preview/twitter-702fdc9efbbc1af56047ee86392919a8.jpg?vsn=d">



&#x20;   <meta name="description" content="description">



&#x20;   <meta name="referrer" content="origin">



&#x20;   <meta name="HandheldFriendly" content="True">

&#x20;   <meta name="viewport" content="width=device-width, initial-scale=1.0">



&#x20;   <link href="/phx/ui/images/favicon/favicon-595d1312b35dfe32838befdf8505515e.ico?vsn=d" rel="shortcut icon" type="image/x-icon">

<link href="/phx/ui/images/favicon/apple-touch-icon-3e4c9ce127b5cd6f5516638d4bbf1dd5.png?vsn=d" rel="apple-touch-icon" sizes="180x180">

<link href="/phx/ui/images/favicon/favicon-32x32-803ad2058b86df3f8a9f8af1505a59d2.png?vsn=d" rel="icon" sizes="32x32" type="image/png">

<link href="/phx/ui/images/favicon/favicon-16x16-6963a8113fc4dc87910c17c4279a9bd4.png?vsn=d" rel="icon" sizes="16x16" type="image/png">

<link href="/phx/ui/images/favicon/site-4ed2b515513825854b905e85931b4a55.webmanifest?vsn=d" rel="manifest">

<link href="/phx/ui/images/favicon/safari-pinned-tab-987c7fc8f545337872c691fbc736e9c4.svg?vsn=d" rel="mask-icon" color="#4d7cfe">

<meta content="#4d7cfe" name="msapplication-TileColor">

<meta content="#ffffff" name="theme-color">

&#x20;   <style>

&#x20; html:not(.motion-on) \* { 

&#x20;   transition: none !important; 

&#x20;   animation: none !important;

&#x20; }

</style>



<script>

&#x20; document.addEventListener("DOMContentLoaded", () => {

&#x20;   document.documentElement.classList.add('motion-on')

&#x20; })

</script>

&#x20;   <style>

&#x20; @font-face {

&#x20;   font-family: 'Fricolage Grotesque';

&#x20;   font-weight: 100 900;

&#x20;   font-display: block;

&#x20;   font-style: normal;

&#x20;   font-named-instance: 'Regular';

&#x20;   src: url(/phx/ui/fonts/fricolage-grotesque.var.woff2) format('woff2')

&#x20; }



&#x20; @font-face {

&#x20;   font-family: 'Mackinac';

&#x20;   src: url("/phx/ui/fonts/mackinac-medium.woff2") format('woff2');

&#x20;   font-weight: 500;

&#x20;   font-style: normal;

&#x20;   font-display: block;

&#x20; }



&#x20; @font-face {

&#x20;   font-family: 'Mackinac';

&#x20;   src: url("/phx/ui/fonts/mackinac-medium-italic.woff2") format('woff2');

&#x20;   font-weight: 500;

&#x20;   font-style: italic;

&#x20;   font-display: block;

&#x20; }



&#x20; @font-face {

&#x20;   font-family: 'Mackinac';

&#x20;   src: url("/phx/ui/fonts/mackinac-bold.woff2") format('woff2');

&#x20;   font-weight: 700;

&#x20;   font-style: normal;

&#x20;   font-display: block;

&#x20; }



&#x20; @font-face {

&#x20;   font-family: 'Mackinac';

&#x20;   src: url("/phx/ui/fonts/mackinac-bold-italic.woff2") format('woff2');

&#x20;   font-weight: 700;

&#x20;   font-style: italic;

&#x20;   font-display: block;

&#x20; }



&#x20; @font-face {

&#x20;   font-family: 'Fragment Mono';

&#x20;   src: url("/phx/ui/fonts/fragment-mono-regular.woff2") format('woff2');

&#x20;   font-weight: 400;

&#x20;   font-style: normal;

&#x20;   font-display: block;

&#x20; }



&#x20; @font-face {

&#x20;   font-family: 'Fragment Mono';

&#x20;   src: url("/phx/ui/fonts/fragment-mono-italic.woff2") format('woff2');

&#x20;   font-weight: 400;

&#x20;   font-style: italic;

&#x20;   font-display: block;

&#x20; }

</style>



<script>

&#x20; var fontsInServiceWorker = sessionStorage.foutFontsStage1Loaded \&\& sessionStorage.foutFontsStage2Loaded || ('serviceWorker' in navigator \&\& navigator.serviceWorker.controller !== null \&\& navigator.serviceWorker.controller.state === 'activated')

&#x20; if (!fontsInServiceWorker \&\& 'fonts' in document) {

&#x20;   function fetchFonts(fonts) {

&#x20;     return Promise.all(fonts.map(function (font) {

&#x20;       return document

&#x20;         .fonts

&#x20;         .load(font);

&#x20;     }));

&#x20;   }



&#x20;   if (sessionStorage.foutFontsStage2Loaded) {

&#x20; 		document.documentElement.className += " wf-loaded-stage2";

&#x20; 	} else {

&#x20;     sessionStorage.foutFontsStage1Loaded = true;

&#x20;   };

&#x20; }



&#x20; if ("fonts" in document) {

&#x20;   let sansRoman = new FontFace(

&#x20;     "Fricolage Grotesque",

&#x20;     "url('/phx/ui/fonts/fricolage-grotesque.var.woff2') format('woff2')",

&#x20;     {

&#x20;       weight: "100 900",

&#x20;       style: "normal"

&#x20;     }

&#x20;   );



&#x20;   let serifMedium = new FontFace(

&#x20;     "Mackinac",

&#x20;     "url('/phx/ui/fonts/mackinac-medium.woff2') format('woff2')",

&#x20;     { weight: "500" }

&#x20;   );



&#x20;   let serifMediumItalic = new FontFace(

&#x20;     "Mackinac",

&#x20;     "url('/phx/ui/fonts/mackinac-medium-italic.woff2') format('woff2')",

&#x20;     { 

&#x20;       weight: "500", 

&#x20;       style: "italic" 

&#x20;     }

&#x20;   );



&#x20;   let serifBold = new FontFace(

&#x20;     "Mackinac",

&#x20;     "url('/phx/ui/fonts/mackinac-bold.woff2') format('woff2')",

&#x20;     { weight: "700" }

&#x20;   );



&#x20;   let serifBoldItalic = new FontFace(

&#x20;     "Mackinac",

&#x20;     "url('/phx/ui/fonts/mackinac-bold-italic.woff2') format('woff2')",

&#x20;     { 

&#x20;       weight: "700", 

&#x20;       style: "italic" 

&#x20;     }

&#x20;   );



&#x20;   let monoRegular = new FontFace(

&#x20;     "FragmentMono",

&#x20;     "url('/phx/ui/fonts/fragment-mono-regular.woff2') format('woff2')",

&#x20;     { weight: "400" }

&#x20;   );



&#x20;   let monoItalic = new FontFace(

&#x20;     "FragmentMono",

&#x20;     "url('/phx/ui/fonts/fragment-mono-italic.woff2') format('woff2')",

&#x20;     { 

&#x20;       weight: "400", 

&#x20;       style: "italic" 

&#x20;     }

&#x20;   );



&#x20;   let loadedFonts = Promise.all(\[

&#x20;     sansRoman.load(),

&#x20;     serifMedium.load(),

&#x20;     serifMediumItalic.load(),

&#x20;     serifBold.load(),

&#x20;     serifBoldItalic.load(),

&#x20;     monoRegular.load(),

&#x20;     monoItalic.load()

&#x20;     

&#x20;   ]).then(result => {

&#x20;     result.forEach(font => document.fonts.add(font));

&#x20;     document.documentElement.classList.add('wf-loaded-stage2');

&#x20;     sessionStorage.foutFontsStage2Loaded = true;

&#x20;   }).catch(error => {

&#x20;     throw new Error(`Error caught: ${error}`);

&#x20;   });



&#x20; }



&#x20; if (

&#x20;   (sessionStorage.foutFontsStage1Loaded \&\&

&#x20;     sessionStorage.foutFontsStage2Loaded) ||

&#x20;   ('serviceWorker' in navigator \&\&

&#x20;     navigator.serviceWorker.controller !== null \&\&

&#x20;     navigator.serviceWorker.controller.state === 'activated')

&#x20; ) {



&#x20;   document.documentElement.classList.add('wf-loaded-stage2')

&#x20; }

</script>



<link rel="preload" href="/phx/ui/fonts/fricolage-grotesque.var.woff2" as="font" type="font/woff2" crossorigin>

<link rel="preload" href="/phx/ui/fonts/mackinac-medium.woff2" as="font" type="font/woff2" crossorigin>

<link rel="preload" href="/phx/ui/fonts/mackinac-medium-italic.woff2" as="font" type="font/woff2" crossorigin>

<link rel="preload" href="/phx/ui/fonts/mackinac-bold.woff2" as="font" type="font/woff2" crossorigin>

<link rel="preload" href="/phx/ui/fonts/mackinac-bold-italic.woff2" as="font" type="font/woff2" crossorigin>

<link rel="preload" href="/phx/ui/fonts/fragment-mono-regular.woff2" as="font" type="font/woff2" crossorigin>

<link rel="preload" href="/phx/ui/fonts/fragment-mono-italic.woff2" as="font" type="font/woff2" crossorigin>



&#x20;   <link phx-track-static rel="stylesheet" href="/phx/assets/app-7f52161a2a1b63c77ac8d5030005d35e.css?vsn=d">

&#x20;   <script src="https://cdn.jsdelivr.net/npm/@easepick/datetime@1.2.1/dist/index.umd.min.js">

&#x20;   </script>

&#x20;   <script src="https://cdn.jsdelivr.net/npm/@easepick/core@1.2.1/dist/index.umd.min.js">

&#x20;   </script>

&#x20;   <script src="https://cdn.jsdelivr.net/npm/@easepick/base-plugin@1.2.1/dist/index.umd.min.js">

&#x20;   </script>

&#x20;   <script src="https://cdn.jsdelivr.net/npm/@easepick/range-plugin@1.2.1/dist/index.umd.min.js">

&#x20;   </script>

&#x20;   <script src="https://cdn.jsdelivr.net/npm/@easepick/preset-plugin@1.2.1/dist/index.umd.min.js">

&#x20;   </script>

&#x20;   <script src="https://cdn.jsdelivr.net/npm/@easepick/lock-plugin@1.2.1/dist/index.umd.min.js">

&#x20;   </script>

&#x20;   <script defer phx-track-static type="text/javascript" src="/phx/assets/js/app-69771a605cec3b5f0ba0f83576b3a1ac.js?vsn=d">

&#x20;   </script>



&#x20;   



&#x20;   <!-- Google Tag Manager -->

<script>

&#x20; (function(w,d,s,l,i){w\[l]=w\[l]||\[];w\[l].push({'gtm.start':

&#x20; new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)\[0],

&#x20; j=d.createElement(s),dl=l!='dataLayer'?'\&l='+l:'';j.async=true;j.src=

&#x20; 'https://analytics.fly.io/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);

&#x20; })(window,document,'script','dataLayer','GTM-M35Q2HRQ');

</script>

<!-- End Google Tag Manager -->



<script id="google-tag-sdk" async src="https://analytics.fly.io/gtag/js?id=G-EX6DMZ1DZV">

</script>

<script id="google-tag-trigger">

&#x20; const tagId = 'G-EX6DMZ1DZV'



&#x20; window.dataLayer = window.dataLayer || \[];

&#x20; function gtag(){dataLayer.push(arguments);}

&#x20; gtag('js', new Date());

&#x20; 

&#x20; gtag('config', tagId, {

&#x20;   'user\_id': '1567398',

&#x20;   'transport\_url': 'https://analytics.fly.io',

&#x20;   'first\_party\_collection': true

&#x20; });

&#x20; 



&#x20; // Wrap in async IIFE to use await

&#x20; (async function() {

&#x20;   // Get CSRF token once for both requests

&#x20;   const csrfResponse = await fetch("/api/csrftoken");

&#x20;   if (!csrfResponse.ok) {

&#x20;     console.error('Failed to fetch CSRF token:', csrfResponse.status, csrfResponse.statusText);

&#x20;     return;

&#x20;   }

&#x20;   const csrfToken = await csrfResponse.text();



&#x20;   // Capture client\_id

&#x20;   gtag('get', tagId, 'client\_id', async function(client\_id) {

&#x20;     try {

&#x20;       await fetch('/api/secret/google-client-id', {

&#x20;         method: 'POST',

&#x20;         headers: {

&#x20;           'Content-Type': 'application/json',

&#x20;           'X-CSRF-Token': csrfToken

&#x20;         },

&#x20;         body: JSON.stringify({

&#x20;           google\_client\_id: client\_id

&#x20;         })

&#x20;       })

&#x20;     } catch (error) {

&#x20;       console.error('Error posting Google client\_id:', error);

&#x20;     }

&#x20;   })



&#x20;   // Capture session\_id

&#x20;   gtag('get', tagId, 'session\_id', async function(session\_id) {

&#x20;     try {

&#x20;       await fetch('/api/secret/google-session-id', {

&#x20;         method: 'POST',

&#x20;         headers: {

&#x20;           'Content-Type': 'application/json',

&#x20;           'X-CSRF-Token': csrfToken

&#x20;         },

&#x20;         body: JSON.stringify({

&#x20;           session\_id: session\_id

&#x20;         })

&#x20;       })

&#x20;     } catch (error) {

&#x20;       console.error('Error posting Google session\_id:', error);

&#x20;     }

&#x20;   })

&#x20; })();

</script>

&#x20;   

&#x20; </head>



&#x20; <body class="my-app-sandbox relative w-full min-h-full md:grid grid-rows-auto-span grid-cols-1 text-sm lg:pb-0 bg-navy-50 bg-custom bg-cover bg-no-repeat bg-fixed " style="--bg: url(/phx/ui/images/app-shapes-e20dd6e0903d3a31595108e6e1052a1e.webp?vsn=d);">

&#x20;   <!-- Google Tag Manager (noscript) -->

<noscript>

&#x20; <iframe src="https://analytics.fly.io/ns.html?id=GTM-M35Q2HRQ" height="0" width="0" style="display:none;visibility:hidden">

&#x20; </iframe>

</noscript>

<!-- End Google Tag Manager (noscript) -->





&#x20;   

&#x20;   



&#x20;   <div class="relative h-full row-span-2">

&#x20;     <div id="phx-GK1mfg1Y3zacFRYC" data-phx-main data-phx-session="SFMyNTY.g2gDaAJhBnQAAAAIdwJpZG0AAAAUcGh4LUdLMW1mZzFZM3phY0ZSWUN3B3Nlc3Npb250AAAAAHcEdmlld3cgRWxpeGlyLkZseVdlYi5EYXNoYm9hcmRMaXZlLkFwcHN3CnBhcmVudF9waWR3A25pbHcGcm91dGVydxRFbGl4aXIuRmx5V2ViLlJvdXRlcncRbGl2ZV9zZXNzaW9uX25hbWV3HWF1dGhlbnRpY2F0ZWRfZGFzaGJvYXJkX3BhZ2Vzdwhyb290X3BpZHcDbmlsdwlyb290X3ZpZXd3IEVsaXhpci5GbHlXZWIuRGFzaGJvYXJkTGl2ZS5BcHBzbgYAVPJjBJ4BYgABUYA.us7fX7cBhaAqcHYDvLS7Qqdb0g0HsafpMUP0nWDjDgA" data-phx-static="SFMyNTY.g2gDaAJhBnQAAAADdwJpZG0AAAAUcGh4LUdLMW1mZzFZM3phY0ZSWUN3BWZsYXNodAAAAAB3CmFzc2lnbl9uZXdsAAAAD3caZ2l0aHViX2luc3RhbGxhdGlvbnNfZXJyb3J3GmNyZWF0ZV9hcHBfZGVwbG95X3J1bm5pbmc\_dwtjb21taXRfZGF0YXcEcmVwb3cPbXBnX3YyX2VuYWJsZWQ\_dxVtcGdfaW5zaWdodHNfZW5hYmxlZD93FG1wZ19leHBsb3JlX2VuYWJsZWQ\_dxljdXJyZW50X3VzZXJfY2FuX3NlZV9tcGc\_dwhsb2FkaW5nP3cTaXNzdWVzX2FjdGl2ZV9jb3VudHcOZ3JhcGhxbF9jb25maWd3CHVpX3Rva2Vudwl0b2tlbl9rZXl3CnVzZXJfdG9rZW53DGN1cnJlbnRfdXNlcmpuBgBV8mMEngFiAAFRgA.vjvTSBYhUAGp9D9E0a0NTFOjyPQsC9On\_K9ptJG8tdI" class="h-full w-full min-h-screen"><header class="relative z-\[500] w-full text-xs lg:text-sm font-semibold lg:font-medium text-navy-900 shadow bg-white/75">

&#x20; <div class="flex justify-between items-center w-full h-16 max-w-\[94rem] mx-auto px-4 sm:px-8">

&#x20;   <div class="flex flex-row items-center gap-x-4">

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com" data-phx-link="redirect" data-phx-link-state="push">

&#x20;       

<svg aria-labelledby="title-GK1mfhB1XamcFZTRdescription-GK1mfhB1uMGcFZTh" class="text-navy" role="img" style="pointer-events: none; width: auto; height: 36px;" aria-hidden="true" viewBox="0 0 82 84" fill-rule="evenodd">

&#x20; <title id="title-GK1mfhB2h7WcFZTx">

&#x20;   

&#x20;     

&#x20;   

&#x20; </title>

&#x20; <desc id="description-GK1mfhB2sW2cFZUB">

&#x20;   

&#x20;     

&#x20;   

&#x20; </desc>

&#x20; 

&#x20; <g buffered-rendering="static">



&#x20;     <path d="M57.413 10.134h9.454c8.409 0 15.236 6.827 15.236 15.236v33.243c0 8.409-6.827 15.236-15.236 15.236h-.745c-4.328-.677-6.205-1.975-7.655-3.072l-12.02-9.883a1.692 1.692 0 0 0-2.128 0l-3.905 3.211-10.998-9.043a1.688 1.688 0 0 0-2.127 0L12.01 68.503c-3.075 2.501-5.109 2.039-6.428 1.894C2.175 67.601 0 63.359 0 58.613V25.37c0-8.409 6.827-15.236 15.237-15.236h9.433l-.017.038-.318.927-.099.318-.428 1.899-.059.333-.188 1.902-.025.522-.004.183.018.872.043.511.106.8.135.72.16.663.208.718.54 1.52.178.456.94 1.986.332.61 1.087 1.866.416.673 1.517 2.234.219.296 1.974 2.569.638.791 2.254 2.635.463.507 1.858 1.999.736.762 1.216 1.208-.244.204-.152.137c-.413.385-.805.794-1.172 1.224a10.42 10.42 0 0 0-.504.644 8.319 8.319 0 0 0-.651 1.064 6.234 6.234 0 0 0-.261.591 5.47 5.47 0 0 0-.353 1.606l-.007.475a5.64 5.64 0 0 0 .403 1.953 5.44 5.44 0 0 0 1.086 1.703c.338.36.723.674 1.145.932.359.22.742.401 1.14.539a6.39 6.39 0 0 0 2.692.306h.005a6.072 6.072 0 0 0 2.22-.659c.298-.158.582-.341.848-.549a5.438 5.438 0 0 0 1.71-2.274c.28-.699.417-1.446.405-2.198l-.022-.393a5.535 5.535 0 0 0-.368-1.513 6.284 6.284 0 0 0-.285-.618 8.49 8.49 0 0 0-.67-1.061 11.022 11.022 0 0 0-.354-.453 14.594 14.594 0 0 0-1.308-1.37l-.329-.28.557-.55 2.394-2.5.828-.909 1.287-1.448.837-.979 1.194-1.454.808-1.016 1.187-1.587.599-.821.85-1.271.708-1.083 1.334-2.323.763-1.524.022-.047.584-1.414a.531.531 0 0 0 .02-.056l.629-1.962.066-.286.273-1.562.053-.423.016-.259.019-.978-.005-.182-.05-.876-.062-.68-.31-1.961c-.005-.026-.01-.052-.018-.078l-.398-1.45-.137-.403-.179-.446Zm4.494 41.455a3.662 3.662 0 0 0-3.61 3.61 3.663 3.663 0 0 0 3.61 3.609 3.665 3.665 0 0 0 3.611-3.609 3.663 3.663 0 0 0-3.611-3.61Z" fill="url(#bri\_Radial1)"></path>



&#x20;   <path d="M35.639 72.544l-.637.535a3.332 3.332 0 01-2.09.762H15.235a15.176 15.176 0 01-9.654-3.451c1.319.145 3.353.607 6.428-1.894l15.277-13.44a1.693 1.693 0 012.127 0l10.997 9.042 3.904-3.21c.619-.5 1.51-.5 2.128 0l12.019 9.882c1.45 1.097 3.327 2.394 7.654 3.071H58.12a3.394 3.394 0 01-1.963-.654l-.14-.108-.593-.493a1.247 1.247 0 00-.158-.159c-.672-.563-9.187-7.617-9.187-7.617a1 1 0 00-1.281.002s.021.026-9.038 7.615a1.12 1.12 0 00-.121.117zm26.262-20.96a3.678 3.678 0 00-3.61 3.609 3.68 3.68 0 003.61 3.609 3.68 3.68 0 003.61-3.609 3.678 3.678 0 00-3.61-3.609zM38.566 40.648L37.35 39.44l-.736-.762-1.858-1.999-.463-.507-2.253-2.634-.638-.791-1.974-2.569-.219-.296-1.517-2.234-.416-.673-1.087-1.866-.332-.61-.94-1.985-.178-.456-.539-1.52-.208-.718-.16-.663-.135-.72-.106-.8-.043-.511-.018-.872.004-.183.025-.522.188-1.901.059-.333.428-1.899.098-.318.318-.927.102-.24.506-1.112.351-.662.489-.806.487-.718.347-.456.4-.482.44-.484.377-.378.918-.808.671-.549c.016-.014.033-.026.05-.038l.794-.537.631-.402 1.198-.631c.018-.011.039-.02.058-.029l1.698-.705.157-.059 1.51-.442.638-.143.862-.173.572-.087.877-.109.598-.053 1.187-.063.465-.005.881.018.229.013 1.276.106 1.687.238.195.041 1.668.415.49.146.544.188.663.251.524.222.77.363.485.249.872.512.325.2 1.189.868.341.296.828.754.041.041.703.754.242.273.825 1.096.168.262.655 1.106.197.379.369.825.386.963.137.403.398 1.45a.89.89 0 01.018.078l.31 1.961.062.679.05.876.005.182-.019.978-.016.259-.053.423-.273 1.562-.066.286-.629 1.962a.626.626 0 01-.02.056l-.584 1.414-.022.047-.763 1.523-1.334 2.323-.708 1.083-.849 1.271-.599.821-1.187 1.587-.808 1.016-1.194 1.453-.837.979-1.287 1.448-.828.909-2.394 2.5-.556.55.328.28c.465.428.902.885 1.308 1.37.122.148.24.299.354.453.249.336.473.691.67 1.06.106.2.201.407.285.618.191.484.32.996.368 1.513l.022.393c.012.752-.125 1.5-.405 2.198a5.438 5.438 0 01-1.71 2.274c-.266.208-.55.391-.848.549a6.08 6.08 0 01-2.219.659h-.005a6.403 6.403 0 01-2.692-.306 5.882 5.882 0 01-1.14-.539 5.523 5.523 0 01-1.145-.932 5.458 5.458 0 01-1.086-1.703 5.662 5.662 0 01-.403-1.953l.007-.475a5.47 5.47 0 01.353-1.606c.077-.202.164-.399.261-.591.19-.37.408-.725.651-1.063.159-.221.328-.436.504-.644.367-.43.759-.839 1.172-1.224l.152-.137.244-.204z" class="fill-current"></path>

&#x20;   <path d="M35.002 73.079l9.796-8.267a1 1 0 011.281-.002l9.938 8.269c.604.492 1.36.761 2.139.762h-25.28c.776 0 1.527-.269 2.126-.762zM41.1 43.568l.096.028c.031.015.057.036.085.055l.08.071c.198.182.39.373.575.569.13.139.257.282.379.43.155.187.3.383.432.587.057.09.11.181.16.276.043.082.082.167.116.253.06.15.105.308.119.469l-.003.302a1.726 1.726 0 01-.817 1.343 2.333 2.333 0 01-.994.327l-.373.011-.315-.028a2.398 2.398 0 01-.433-.105 2.07 2.07 0 01-.41-.192l-.246-.18a1.685 1.685 0 01-.56-.96 2.418 2.418 0 01-.029-.19l-.009-.288c.005-.078.017-.155.034-.232.043-.168.105-.331.183-.486.101-.194.216-.381.344-.559.213-.288.444-.562.691-.821.159-.168.322-.331.492-.488l.121-.109c.084-.055.085-.055.181-.083h.101zM40.481 3.42l.039-.003v33.665l-.084-.155a94.101 94.101 0 01-3.093-6.267 67.257 67.257 0 01-2.099-5.255 41.665 41.665 0 01-1.265-4.326c-.265-1.163-.469-2.343-.553-3.535a16.923 16.923 0 01-.029-1.528c.008-.444.026-.887.054-1.33.044-.696.115-1.391.217-2.081.081-.543.181-1.084.304-1.619.098-.425.212-.847.342-1.262.188-.6.413-1.186.675-1.758.096-.206.199-.411.307-.612.65-1.204 1.532-2.313 2.687-3.054a5.609 5.609 0 012.498-.88zm4.365.085l2.265.646c1.049.387 2.059.891 2.987 1.521a11.984 11.984 0 013.212 3.204c.502.748.918 1.555 1.243 2.398.471 1.247.763 2.554.866 3.882.03.348.047.697.054 1.046.008.324.006.649-.02.973-.064.725-.2 1.442-.407 2.14a17.03 17.03 0 01-.587 1.684c-.28.685-.591 1.357-.932 2.013-.754 1.457-1.623 2.852-2.553 4.201a65.451 65.451 0 01-3.683 4.806 91.02 91.02 0 01-4.417 4.896 93.66 93.66 0 002.907-5.949c.5-1.124.971-2.26 1.414-3.407.487-1.26.927-2.537 1.317-3.83.29-.969.546-1.948.757-2.938.181-.849.323-1.707.411-2.57.074-.72.101-1.444.083-2.166a30.867 30.867 0 00-.049-1.325c-.106-1.775-.376-3.545-.894-5.248a15.341 15.341 0 00-.714-1.892c-.663-1.444-1.588-2.793-2.84-3.778l-.42-.307z" fill="white"></path>



&#x20; </g>

&#x20; <defs>

&#x20;   <radialGradient id="bri\_Radial1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(43.593 41.714) scale(59.4764)">

&#x20;     <stop offset="0" stop-color="#ba7bf0"></stop>

&#x20;     <stop offset=".45" stop-color="#996bec"></stop>

&#x20;     <stop offset="1" stop-color="#5046e4"></stop>

&#x20;   </radialGradient>

&#x20; </defs>



</svg>

&#x20;     </a>

&#x20;   </div>

&#x20;   <nav class="flex items-center gap-2">















&#x20;         <div class="group relative ml-1 mt-3 mb-0 px-2 pt-2 pb-5">

&#x20;           <a href="/dashboard/dublinsistemas-gmail-com/settings" data-phx-link="redirect" data-phx-link-state="push" class="absolute inset-0 z-10 cursor-pointer" aria-label="Resource usage settings">

&#x20;             <span class="sr-only">Resource usage settings</span>

&#x20;           </a>

&#x20;           

&#x20;   

&#x20;     <div class="flex items-center gap-0.5">

&#x20; <div class="w-1 h-2 bg-gray-300 rounded"></div>

&#x20; <div class="w-1 h-2 bg-gray-300 rounded"></div>

&#x20; <div class="w-1 h-2 bg-gray-300 rounded"></div>

</div>

&#x20;   

&#x20; 

&#x20;         </div>







&#x20;     <a href="/dashboard" data-phx-link="redirect" data-phx-link-state="push" class="group grid gap-x-2.5 gap-y-1.5 grid-cols-1 lg:grid-cols-auto-span items-center justify-items-center lg:justify-items-start mx-1 px-3 py-2 rounded-lg bg-transparent hocus:bg-violet-100 transition-colors whitespace-nowrap">

&#x20;       <span class="flex items-center justify-center">

&#x20;         

<svg role="img" class="text-violet-500 group-hover:text-violet-700 group-focus-within:text-violet-700 transition-colors" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">

&#x20;   <path d="M19 13.6a2.347 2.347 0 00-2.314-2.314H13.6a2.347 2.347 0 00-2.314 2.314v3.086A2.347 2.347 0 0013.6 19h3.086A2.35 2.35 0 0019 16.686V13.6z" fill-opacity=".4"></path>

&#x20;   <path d="M8.714 13.6A2.347 2.347 0 006.4 11.286H3.314A2.347 2.347 0 001 13.6v3.086A2.35 2.35 0 003.314 19H6.4a2.347 2.347 0 002.314-2.314V13.6zM19 3.314A2.35 2.35 0 0016.686 1H13.6a2.347 2.347 0 00-2.314 2.314V6.4A2.347 2.347 0 0013.6 8.714h3.086A2.347 2.347 0 0019 6.4V3.314zm-10.286 0A2.347 2.347 0 006.4 1H3.314A2.35 2.35 0 001 3.314V6.4a2.347 2.347 0 002.314 2.314H6.4A2.347 2.347 0 008.714 6.4V3.314z"></path>

&#x20; </g>

</svg>

&#x20;       </span>

&#x20;       Dashboard

&#x20;     </a>

&#x20;     <a class="group grid gap-x-2.5 gap-y-1.5 grid-cols-1 lg:grid-cols-auto-span items-center justify-items-center lg:justify-items-start mx-1 px-3 py-2 rounded-lg bg-transparent hocus:bg-violet-100 transition-colors whitespace-nowrap" href="https://community.fly.io/c/fresh-produce/27?order=created" target="\_blank">

&#x20;       <span class="flex items-center justify-center">

&#x20;         

<svg role="img" class="text-violet-500 group-hover:text-violet-700 group-focus-within:text-violet-700 transition-colors" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g buffered-rendering="static">

&#x20;   <path d="M9.292 5.132a9.061 9.061 0 011.874 4.287c.026.277.05.555.072.833.014 2.705.014 5.411 0 8.116-.196.75-.685 1.086-1.467 1.01-.585-.132-.921-.496-1.009-1.093-.011-2.13-.014-4.259-.011-6.389-2.427-.047-4.505-.914-6.233-2.602C.842 7.509.01 5.386.02 2.926c.131-.554.475-.891 1.031-1.01a15.337 15.337 0 013.288.187 9.346 9.346 0 014.183 2.186c.27.272.526.553.77.843z"></path>

&#x20;   <path d="M10.768 3.779c1.066-1.306 2.482-2.241 4.248-2.804a11.857 11.857 0 014.017-.312c.519.133.835.462.947.988.01 2.702-.972 4.967-2.945 6.796-1.147.959-2.412 1.605-3.796 1.936l-.001-.142c0-.049-.002-.098-.006-.147a49.704 49.704 0 00-.076-.866 11.015 11.015 0 00-2.335-5.386l-.053-.063z" fill-opacity=".5"></path>

&#x20; </g>

</svg>

&#x20;       </span>

&#x20;       What’s New

&#x20;     </a>

&#x20;     <dl class="group relative ml-1 mt-3 mb-0 px-3 pt-2 pb-5 cursor-pointer">

&#x20;       <div class="absolute top-0 left-0 right-0 bottom-3 z-\[-1] bg-transparent group-hover:bg-violet-100 group-focus-within:bg-violet-100 transition-colors rounded-lg">

&#x20;       </div>

&#x20;       <dt class="grid gap-x-2.5 gap-y-1.5 grid-cols-1 lg:grid-cols-auto-span items-center justify-items-center lg:justify-items-start whitespace-nowrap">

&#x20;         <span class="flex items-center justify-center">

&#x20;           

<svg role="img" class="text-violet-500 group-hover:text-violet-700 group-focus-within:text-violet-700 transition-colors" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g buffered-rendering="static">

&#x20;   <path d="M3.632 17.471V3.232c0-1.1.892-1.992 1.991-1.992h8.754c1.099 0 1.992.892 1.992 1.992v14.239c-.064.494-.347.751-.851.769a1.142 1.142 0 01-.435-.152A448.492 448.492 0 0010 14.534a427.549 427.549 0 00-5.082 3.554c-.451.254-.839.184-1.166-.213a1.165 1.165 0 01-.12-.404z"></path>

&#x20; </g>

</svg>

&#x20;         </span>

&#x20;         Resources

&#x20;       </dt>

&#x20;       <dd class="text-\[0.8rem] lg:text-sm text-navy-900 absolute top-full -mt-1 right-\[1000rem] group-hover:right-0 group-focus-within:right-0 flex flex-col bg-white rounded-lg border border-gray-500/10 bg-clip-padding shadow-md shadow-violet-700/10 p-2">

&#x20;         <a class="grid gap-x-2.5 grid-cols-auto-span items-center whitespace-nowrap rounded-md min-w-\[11rem] px-3 py-2 hocus:bg-violet-300/25 transition-colors" target="\_blank" href="https://fly.io/docs/">

&#x20;           <span class="flex items-center justify-center">

&#x20;             

<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">

&#x20;   <path d="M4.897 2.5c-1.334 0-3.19.405-4.267 1.077-.349.218-.567.641-.567 1.102V16.25c0 .439.198.847.522 1.072a.945.945 0 001.059.03c.82-.511 2.239-.781 3.253-.781h.004a5.11 5.11 0 012.715.783.944.944 0 001.057-.033c.324-.225.521-.632.521-1.071V4.679c0-.461-.218-.884-.567-1.102A7.023 7.023 0 004.897 2.5z" fill-opacity=".5"></path>

&#x20;   <path d="M15.105 2.5a7.016 7.016 0 00-3.729 1.075c-.351.217-.57.642-.57 1.104V16.25c0 .439.198.847.522 1.072a.945.945 0 001.059.03 5.111 5.111 0 012.716-.781c1.014 0 2.433.27 3.253.781a.945.945 0 001.059-.03c.324-.225.522-.633.522-1.072V4.679c0-.461-.218-.884-.567-1.102-1.077-.671-2.932-1.077-4.265-1.077z"></path>

&#x20; </g>

</svg>

&#x20;           </span>

&#x20;           Documentation

&#x20;         </a>

&#x20;         <a class="grid gap-x-2.5 grid-cols-auto-span items-center whitespace-nowrap rounded-md min-w-\[11rem] px-3 py-2 hocus:bg-violet-300/25 transition-colors" target="\_blank" href="https://community.fly.io">

&#x20;           <span class="flex items-center justify-center">

&#x20;             

<svg role="img" class="text-violet-500 transition-colors" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g buffered-rendering="static" fill-rule="evenodd">

&#x20;   <path d="M9.983 19.353a.71.71 0 01-.476-.206c-1.613-1.614-.963-3.427-5.388-3.427C1.859 15.718 0 13.858 0 11.598V4.769C.001 2.508 1.861.647 4.122.647h11.756c2.261 0 4.121 1.861 4.122 4.122v6.829c0 2.26-1.859 4.12-4.119 4.122-4.425 0-3.775 1.813-5.388 3.427a.711.711 0 01-.493.206h-.017z" fill-opacity=".4"></path>

&#x20;   <path d="M5.333 6.628c.839.031 1.511.73 1.511 1.569s-.672 1.537-1.511 1.569c-.86 0-1.569-.709-1.569-1.569 0-.861.709-1.569 1.569-1.569zm4.667 0c.838.031 1.511.73 1.511 1.569S10.838 9.734 10 9.766a1.577 1.577 0 01-1.569-1.569c0-.861.708-1.569 1.569-1.569zm4.667 0c.838.031 1.511.73 1.511 1.569s-.673 1.537-1.511 1.569a1.577 1.577 0 01-1.569-1.569c0-.861.708-1.569 1.569-1.569z"></path>

&#x20; </g>

</svg>

&#x20;           </span>

&#x20;           Community Support

&#x20;         </a>

&#x20;         <a class="grid gap-x-2.5 grid-cols-auto-span items-center whitespace-nowrap rounded-md min-w-\[11rem] px-3 py-2 hocus:bg-violet-300/25 transition-colors" target="\_blank" href="https://fly.io/blog/">

&#x20;           <span class="flex items-center justify-center">

&#x20;             

<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g buffered-rendering="static" fill-rule="evenodd">

&#x20;   <path d="M1.5 16.137a2.375 2.375 0 012.363-2.363 2.375 2.375 0 012.363 2.363A2.375 2.375 0 013.863 18.5 2.375 2.375 0 011.5 16.137z" fill-opacity="1"></path>

&#x20;   <path d="M2.222 9.048c0 .9.741 1.641 1.641 1.641 2.989 0 5.448 2.459 5.448 5.448 0 .9.741 1.641 1.641 1.641s1.641-.741 1.641-1.641c0-4.789-3.941-8.73-8.73-8.73-.9 0-1.641.741-1.641 1.641z" fill-opacity=".65"></path>

&#x20;   <path d="M3.863 1.5c-.9 0-1.641.741-1.641 1.641s.741 1.641 1.641 1.641c6.271 0 11.355 5.084 11.355 11.355 0 .9.741 1.641 1.641 1.641s1.641-.741 1.641-1.641C18.5 8.054 11.946 1.5 3.863 1.5z" fill-opacity=".45"></path>

&#x20; </g>

</svg>

&#x20;           </span>

&#x20;           Fly.io Blog

&#x20;         </a>

&#x20;         <a class="grid gap-x-2.5 grid-cols-auto-span items-center whitespace-nowrap rounded-md min-w-\[11rem] px-3 py-2 hocus:bg-violet-300/25 transition-colors" target="\_blank" href="https://fly.io/phoenix-files/">

&#x20;           <span class="flex items-center justify-center">

&#x20;             

<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">

&#x20;   <path d="M7.689 8.071c.315-.348.807-.151 1.206.363.7.904 1.136 1.542 1.837 2.446.158.21.346.388.563.534a.675.675 0 00.579-.061l1.158-1.28c.324-.22.603-.174.838.137.688 1.397.657 2.778-.091 4.144-.697 1.01-1.657 1.614-2.88 1.813a4.944 4.944 0 01-3.351-.579c-1.286-.845-1.926-2.043-1.92-3.595.016-.426.103-.838.259-1.234a11.186 11.186 0 011.802-2.688z" fill-opacity="1"></path>

&#x20;   <path d="M7.822.002c.274-.017.518.059.731.229a31.732 31.732 0 011.661 1.661L11.6 3.507a13.49 13.49 0 011.524-1.722c.316-.223.631-.223.944 0a17.711 17.711 0 014.312 6.932 7.525 7.525 0 01.213 3.748c-.617 3.171-2.379 5.452-5.286 6.84-2.679 1.09-5.259.897-7.74-.578-2.545-1.71-3.972-4.102-4.281-7.176a7.542 7.542 0 01.244-2.56 15.82 15.82 0 012.011-4.174A26.204 26.204 0 017.456.2a1.23 1.23 0 01.366-.198zm-.133 8.069c.315-.348.807-.151 1.206.363.7.904 1.136 1.542 1.837 2.446.158.21.346.388.563.534a.675.675 0 00.579-.061l1.158-1.28c.324-.22.603-.174.838.137.688 1.397.657 2.778-.091 4.144-.697 1.01-1.657 1.614-2.88 1.813a4.944 4.944 0 01-3.351-.579c-1.286-.845-1.926-2.043-1.92-3.595.016-.426.103-.838.259-1.234a11.186 11.186 0 011.802-2.688z" fill-opacity=".45"></path>

&#x20; </g>

</svg>

&#x20;           </span>

&#x20;           Phoenix Files

&#x20;         </a>

&#x20;         <a class="grid gap-x-2.5 grid-cols-auto-span items-center whitespace-nowrap rounded-md min-w-\[11rem] px-3 py-2 hocus:bg-violet-300/25 transition-colors" target="\_blank" href="https://fly.io/laravel-bytes/">

&#x20;           <span class="flex items-center justify-center">

&#x20;             

<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">

&#x20;   <path d="M16.608 4.038l.182.126.148.167.104.195.056.215.004.222-.049.216-.097.199-.142.171-.177.133-5.855 3.379-.246.116-.265.07-.272.024-.272-.024-.264-.07-.247-.116-5.854-3.379-.177-.133-.142-.171-.097-.199-.048-.216.004-.222.056-.215.104-.195.147-.167.182-.126L9.263.913l.235-.102.248-.062.253-.02.255.02.247.062.235.102 5.872 3.125" fill-opacity=".45"></path>

&#x20;   <path d="M17.419 7.067l.203-.087.218-.038.222.015.212.068.189.113.158.155.118.189.07.212.019.22-.23 6.649-.029.252-.07.246-.11.231-.145.209-.177.184-.205.152-5.644 3.524-.2.093-.217.045-.222-.007-.213-.059-.195-.108-.163-.15-.124-.184-.077-.208-.026-.22v-6.759l.023-.273.071-.264.116-.247.156-.224.193-.193.225-.156 5.852-3.38" fill-opacity="1"></path>

&#x20;   <path d="M8.435 10.447l.225.157.193.193.156.224.116.247.071.264.023.272v6.759l-.026.22-.077.208-.124.184-.163.15-.195.109-.213.059-.222.007-.217-.045-.2-.094-5.644-3.524-.205-.152-.177-.183-.145-.21-.11-.231-.07-.244-.029-.254-.23-6.649.019-.22.07-.211.118-.188.158-.156.189-.114.212-.067.222-.014.218.036.203.088 5.854 3.379" fill-opacity=".65"></path>

&#x20; </g>

</svg>

&#x20;           </span>

&#x20;           Laravel Bytes

&#x20;         </a>

&#x20;         <a class="grid gap-x-2.5 grid-cols-auto-span items-center whitespace-nowrap rounded-md min-w-\[11rem] px-3 py-2 hocus:bg-violet-300/25 transition-colors" target="\_blank" href="https://fly.io/ruby-dispatch/">

&#x20;           <span class="flex items-center justify-center">

&#x20;             

<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">

&#x20;   <path d="M5.407 13.483l-3.686 2.144L9.294 20v-4.273l-3.887-2.244zm9.186-6.891l3.686-2.144L10.706.075v4.273l3.887 2.244z" fill-opacity=".65"></path>

&#x20;   <path d="M10.705 15.727V20l7.574-4.374-3.686-2.143-3.888 2.244zm4.595-3.445l3.679 2.127V5.666L15.3 7.793v4.489z" fill-opacity="1"></path>

&#x20;   <path d="M6.111 7.793v4.488L10 14.526l3.889-2.245V7.793L10 5.548 6.111 7.793zM1.022 5.665l-.001 8.742L4.7 12.261V7.793L1.022 5.665zM9.294.074L1.723 4.447l3.684 2.124 3.887-2.224V.074z" fill-opacity=".45"></path>

&#x20; </g>

</svg>

&#x20;           </span>

&#x20;           Ruby Dispatch

&#x20;         </a>

&#x20;         <a class="grid gap-x-2.5 grid-cols-auto-span items-center whitespace-nowrap rounded-md min-w-\[11rem] px-3 py-2 hocus:bg-violet-300/25 transition-colors" target="\_blank" href="https://fly.io/django-beats/">

&#x20;           <span class="flex items-center justify-center">

&#x20;             

<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">

&#x20;   <path d="M19.5 14.239V1.216c0-.399-.19-.773-.512-1.006a1.223 1.223 0 00-1.11-.171L7.454 3.536a1.24 1.24 0 00-.842 1.177v2.459c0 .07.006.14.017.208v9.508h2.43V8.071l8.011-2.687v8.855h2.43z" fill-opacity=".4"></path>

&#x20;   <path d="M4.78 13.845c2.362 0 4.279 1.384 4.279 3.09 0 1.705-1.917 3.09-4.279 3.09S.5 18.64.5 16.935c0-1.706 1.918-3.09 4.28-3.09zm10.44-2.676c2.362 0 4.28 1.384 4.28 3.089 0 1.706-1.918 3.09-4.28 3.09s-4.279-1.384-4.279-3.09c0-1.705 1.917-3.089 4.279-3.089z" fill-opacity="1"></path>

&#x20; </g>

</svg>

&#x20;           </span>

&#x20;           Django Beats

&#x20;         </a>

&#x20;         <a class="grid gap-x-2.5 grid-cols-auto-span items-center whitespace-nowrap rounded-md min-w-\[11rem] px-3 py-2 hocus:bg-violet-300/25 transition-colors" target="\_blank" href="https://fly.io/javascript-journal/">

&#x20;           <span class="flex items-center justify-center">

&#x20;             

<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">

&#x20;   <path d="M17.559 3.907A2.908 2.908 0 0014.652 1H5.931a2.909 2.909 0 00-2.907 2.907v12.186A2.909 2.909 0 005.931 19h8.721a2.908 2.908 0 002.907-2.907V3.907z" fill-opacity=".5"></path>

&#x20;   <path d="M3.024 5.051H1.786a1.03 1.03 0 000 2.058h1.238v1.862H1.786a1.03 1.03 0 000 2.058h1.238v1.862H1.786a1.03 1.03 0 000 2.058h1.238v1.144A2.909 2.909 0 005.931 19h1.51V1h-1.51a2.909 2.909 0 00-2.907 2.907v1.144z" fill-opacity="1"></path>

&#x20; </g>

</svg>

&#x20;           </span>

&#x20;           JavaScript Journal

&#x20;         </a>

&#x20;       </dd>

&#x20;     </dl>

&#x20;     <dl class="group relative ml-1 mt-3 mb-0 px-3 pt-2 pb-5 cursor-pointer">

&#x20;       <div class="absolute top-0 left-0 right-0 bottom-3 z-\[-1] bg-transparent group-hover:bg-violet-100 group-focus-within:bg-violet-100 transition-colors rounded-lg">

&#x20;       </div>

&#x20;       <dt class="grid gap-x-2.5 gap-y-1.5 grid-cols-1 lg:grid-cols-auto-span items-center justify-items-center lg:justify-items-start whitespace-nowrap">

&#x20;         <span class="flex items-center justify-center">

&#x20;           

<svg role="img" class="text-violet-500 group-hover:text-violet-700 group-focus-within:text-violet-700 transition-colors" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g buffered-rendering="static">

&#x20;   <path d="M10 12.66l.015-.001a5.577 5.577 0 003.266-1.06.94.94 0 01.662-.165c1.511.215 2.837 1.016 3.913 2.087 1.414 1.409 1.102 3.736 1.102 3.736 0 3.005-17.916 2.976-17.916 0 0 0-.312-2.327 1.102-3.736 1.076-1.071 2.402-1.872 3.913-2.087a.94.94 0 01.662.165 5.577 5.577 0 003.266 1.06l.015.001z" fill-opacity=".5"></path>

&#x20;   <path d="M10 10a4.752 4.752 0 004.75-4.75A4.752 4.752 0 0010 .5a4.752 4.752 0 00-4.75 4.75A4.752 4.752 0 0010 10z"></path>

&#x20; </g>

</svg>

&#x20;         </span>

&#x20;         Account

&#x20;       </dt>

&#x20;       <dd class="text-\[0.8rem] lg:text-sm text-navy-900 absolute top-full -mt-1 right-\[1000rem] group-hover:right-0 group-focus-within:right-0 flex flex-col bg-white rounded-lg border border-gray-500/10 bg-clip-padding shadow-md shadow-violet-700/10 p-2">

&#x20;         <div class="px-3 mb-2 max-w-\[175px]">

&#x20;           <div>Signed in as</div>

&#x20;           <div class="font-bold truncate">dublinsistemas@gmail.com</div>

&#x20;         </div>

&#x20;         <hr class="h-px mb-1 bg-gray-200 border-0">

&#x20;         <a href="/user/settings" data-phx-link="redirect" data-phx-link-state="push" class="grid gap-x-2.5 grid-cols-auto-span items-center whitespace-nowrap rounded-md min-w-\[11rem] px-3 py-2 hocus:bg-violet-300/25 transition-colors">

&#x20;           <span class="flex items-center justify-center">

&#x20;             

<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">

&#x20;   <path d="M19.058 8.506l-1.906-.522c-.281-.662-.4-.943-.662-1.625l.984-1.725a.579.579 0 00-.101-.723l-1.284-1.284a.586.586 0 00-.723-.101l-1.725.984a37.5 37.5 0 00-1.625-.662L11.494.942A.621.621 0 0010.913.5H9.087a.585.585 0 00-.581.442l-.522 1.906c-.662.281-.943.4-1.625.662l-1.725-.984a.579.579 0 00-.723.101L2.627 3.911a.586.586 0 00-.101.723l.984 1.725a37.5 37.5 0 00-.662 1.625l-1.906.522a.621.621 0 00-.442.581v1.826c0 .281.181.521.442.581l1.906.522c.281.662.4.943.662 1.625l-.984 1.725a.579.579 0 00.101.723l1.284 1.284c.187.198.489.24.723.101l1.725-.984a37.5 37.5 0 001.625.662l.522 1.906a.621.621 0 00.581.442h1.826a.584.584 0 00.581-.442l.522-1.906c.662-.281.943-.4 1.625-.662l1.725.984a.579.579 0 00.723-.101l1.284-1.284a.586.586 0 00.101-.723l-.984-1.725a37.5 37.5 0 00.662-1.625l1.906-.522a.621.621 0 00.442-.581V9.087a.621.621 0 00-.442-.581zM10 6.5c1.932 0 3.5 1.568 3.5 3.5s-1.568 3.5-3.5 3.5A3.501 3.501 0 016.5 10c0-1.932 1.568-3.5 3.5-3.5z" fill-opacity="1"></path>

&#x20; </g>

</svg>

&#x20;           </span>

&#x20;           Settings

&#x20;         </a>

&#x20;         <a href="/organizations" data-phx-link="redirect" data-phx-link-state="push" class="grid gap-x-2.5 grid-cols-auto-span items-center whitespace-nowrap rounded-md min-w-\[11rem] px-3 py-2 hocus:bg-violet-300/25 transition-colors">

&#x20;           <span class="flex items-center justify-center">

&#x20;             

<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">

&#x20;   <path d="M10.032 6.499A3.525 3.525 0 006.532 10a3.525 3.525 0 003.5 3.501A3.526 3.526 0 0013.533 10a3.526 3.526 0 00-3.501-3.501z" fill-opacity="1"></path>

&#x20;   <path d="M8.582 15.386a2.537 2.537 0 00-1.11 2.084 2.547 2.547 0 002.53 2.53 2.546 2.546 0 002.527-2.53 2.532 2.532 0 00-1.091-2.072c-.45.119-.921.184-1.407.185-.5-.001-.987-.07-1.449-.197zm8.89-7.916a2.538 2.538 0 00-2.057 1.069c.129.466.198.956.199 1.461a5.51 5.51 0 01-.199 1.461 2.538 2.538 0 002.057 1.069A2.546 2.546 0 0020.001 10a2.546 2.546 0 00-2.529-2.53zm-14.943 0A2.547 2.547 0 00-.001 10a2.547 2.547 0 002.53 2.53 2.541 2.541 0 002.103-1.136A5.532 5.532 0 014.451 10c.001-.481.064-.948.181-1.394A2.541 2.541 0 002.529 7.47zM10.002 0a2.547 2.547 0 00-2.53 2.53A2.538 2.538 0 008.58 4.614c.463-.127.95-.196 1.451-.197.486.001.958.066 1.408.185a2.536 2.536 0 001.09-2.072A2.546 2.546 0 0010.002 0z" fill-opacity=".45"></path>

&#x20; </g>

</svg>

&#x20;           </span>

&#x20;           Organizations

&#x20;         </a>

&#x20;         <a href="/tokens" data-phx-link="redirect" data-phx-link-state="push" class="grid gap-x-2.5 grid-cols-auto-span items-center whitespace-nowrap rounded-md min-w-\[11rem] px-3 py-2 hocus:bg-violet-300/25 transition-colors">

&#x20;           <span class="flex items-center justify-center">

&#x20;             

<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">

&#x20;   <path d="M19.5 10a9.5 9.5 0 11-19 0 9.5 9.5 0 0119 0z" fill-opacity=".45"></path>

&#x20;   <path d="M12.57 7.797a2.57 2.57 0 00-5.14 0c0 1.019.593 1.896 1.451 2.312l-.717 4.664h3.672l-.718-4.664a2.568 2.568 0 001.452-2.312z" fill-opacity="1"></path>

&#x20; </g>

</svg>

&#x20;           </span>

&#x20;           Access Tokens

&#x20;         </a>

&#x20;         <a class="grid gap-x-2.5 grid-cols-auto-span items-center whitespace-nowrap rounded-md min-w-\[11rem] px-3 py-2 hocus:bg-violet-300/25 transition-colors" href="/app/sign-out">

&#x20;           <span class="flex items-center justify-center">

&#x20;             

<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g buffered-rendering="static" fill-rule="evenodd">





&#x20;     <path d="M16.697 16.808a9.28 9.28 0 002.339-9.535 9.368 9.368 0 00-2.866-4.228 1.527 1.527 0 00-.982-.356c-.829 0-1.512.673-1.512 1.49 0 .436.194.851.531 1.134a6.356 6.356 0 012.265 4.851c0 3.491-2.903 6.368-6.443 6.386h-.024c-3.552 0-6.474-2.881-6.474-6.383 0-1.848.814-3.609 2.23-4.82l.004-.004c.308-.282.484-.678.484-1.093 0-.818-.682-1.49-1.512-1.49-.347 0-.683.118-.952.333l-.004.004A9.314 9.314 0 00.5 10.177c0 2.367.91 4.648 2.546 6.381a9.566 9.566 0 006.948 2.98 9.568 9.568 0 006.703-2.73z" fill-opacity="1"></path>

&#x20;     <path d="M8.492 1.453v8.302c.002.818.684 1.49 1.513 1.49.264 0 .524-.069.754-.199.467-.266.755-.758.755-1.291V1.453C11.494.649 10.818 0 10.003 0c-.814 0-1.49.649-1.511 1.453z" fill-opacity=".45"></path>



&#x20; </g>

</svg>

&#x20;           </span>

&#x20;           Sign out

&#x20;         </a>

&#x20;       </dd>

&#x20;     </dl>

&#x20;   </nav>

&#x20; </div>

</header>













<div>

&#x20; <div class="w-full max-w-\[94rem] mx-auto flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6 py-4 lg:py-6 px-4 sm:px-8 pb-16 lg:pb-6 overflow-x-hidden lg:overflow-x-visible">

&#x20; <div class="space-y-4 lg:w-72 lg:relative lg:z-10">

&#x20;   

&#x20;     

&#x20; 

&#x20; <div>

&#x20;   <label class="block text-sm font-medium text-gray-700 mb-1">

&#x20;     Organization

&#x20;   </label>

&#x20;   <button type="button" class="btn relative w-full justify-normal border-navy-300 px-3 shadow-sm shadow-violet-200/50 focus:outline-0" phx-click="\[\[\&quot;dispatch\&quot;,{\&quot;to\&quot;:\&quot;#org-command-palette\&quot;,\&quot;event\&quot;:\&quot;palette:open\&quot;}]]">

&#x20;     <div class="flex items-center gap-2">

&#x20;       

<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">

&#x20;   <path d="M10.032 6.499A3.525 3.525 0 006.532 10a3.525 3.525 0 003.5 3.501A3.526 3.526 0 0013.533 10a3.526 3.526 0 00-3.501-3.501z" fill-opacity="1"></path>

&#x20;   <path d="M8.582 15.386a2.537 2.537 0 00-1.11 2.084 2.547 2.547 0 002.53 2.53 2.546 2.546 0 002.527-2.53 2.532 2.532 0 00-1.091-2.072c-.45.119-.921.184-1.407.185-.5-.001-.987-.07-1.449-.197zm8.89-7.916a2.538 2.538 0 00-2.057 1.069c.129.466.198.956.199 1.461a5.51 5.51 0 01-.199 1.461 2.538 2.538 0 002.057 1.069A2.546 2.546 0 0020.001 10a2.546 2.546 0 00-2.529-2.53zm-14.943 0A2.547 2.547 0 00-.001 10a2.547 2.547 0 002.53 2.53 2.541 2.541 0 002.103-1.136A5.532 5.532 0 014.451 10c.001-.481.064-.948.181-1.394A2.541 2.541 0 002.529 7.47zM10.002 0a2.547 2.547 0 00-2.53 2.53A2.538 2.538 0 008.58 4.614c.463-.127.95-.196 1.451-.197.486.001.958.066 1.408.185a2.536 2.536 0 001.09-2.072A2.546 2.546 0 0010.002 0z" fill-opacity=".45"></path>

&#x20; </g>

</svg>

&#x20;       <div class="inline-block truncate">Personal</div>

&#x20;     </div>

&#x20;     <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">

&#x20;       <kbd class="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-navy-100 text-\[11px] font-mono text-navy-400">

&#x20;         <span class="text-\[13px]">\&#8984;</span>K

&#x20;       </kbd>

&#x20;       <span class="hero-magnifying-glass-mini sm:hidden w-4 h-4 text-navy-400"></span>

&#x20;     </span>

&#x20;   </button>

&#x20; </div>







<div id="org-command-palette" phx-hook="OrgCommandPalette">

&#x20; 

&#x20; <div id="org-palette-modal" class="relative z-\[10000] hidden">

&#x20;   <div id="org-palette-modal-bg" class="bg-navy-950/50 fixed inset-0 transition-opacity backdrop-blur-sm opacity-0" aria-hidden="true"></div>

&#x20;   <div class="fixed inset-0 overflow-y-auto" role="dialog" aria-modal="true" tabindex="0">

&#x20;     <div class="flex min-h-full items-start justify-center pt-\[12vh] px-4">

&#x20;       <div id="org-palette-modal-container" phx-click-away="\[\[\&quot;dispatch\&quot;,{\&quot;to\&quot;:\&quot;#org-command-palette\&quot;,\&quot;event\&quot;:\&quot;palette:close\&quot;}]]" class="relative hidden w-full max-w-lg bg-white rounded-xl shadow-2xl shadow-navy-700/10 ring-1 ring-black/5 transition scale-95 opacity-0">

&#x20;         <div id="org-palette-modal-content">

&#x20;           

&#x20;           <div class="relative">

&#x20;             <span class="hero-magnifying-glass-mini absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400 pointer-events-none"></span>

&#x20;             

&#x20;             <form phx-change="search" phx-submit="search" phx-target="1">

&#x20;               <input id="org-palette-search" type="text" placeholder="Search organizations..." value="" name="value" autocomplete="off" phx-debounce="150" class="w-full pl-12 pr-20 py-4 text-base border-0 border-b border-navy-100 rounded-t-xl focus:ring-0 focus:border-navy-200 placeholder-navy-400">

&#x20;               

&#x20;               <kbd class="hidden sm:inline-flex absolute right-4 top-1/2 -translate-y-1/2 items-center gap-0.5 px-1.5 py-0.5 rounded bg-navy-100 text-\[11px] font-mono text-navy-400 pointer-events-none">

&#x20;                 <span class="text-\[13px]">\&#8984;</span>K

&#x20;               </kbd>

&#x20;             </form>

&#x20;           </div>



&#x20;           

&#x20;           <div id="org-palette-list" class="max-h-80 overflow-y-auto overscroll-contain" role="listbox">

&#x20;             



&#x20;             <a href="/dashboard/dublinsistemas-gmail-com" data-phx-link="redirect" data-phx-link-state="push" id="org-palette-item-0" class="block px-4 py-3 transition-colors cursor-pointer border-l-2 border-transparent hover:bg-navy-50" role="option" aria-selected="false">

&#x20;               <div class="flex items-center gap-2.5 min-w-0">

&#x20;                 

<svg role="img" class="text-violet-500 shrink-0" style="pointer-events: none; width: 16px; height: 16px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">

&#x20;   <path d="M10.032 6.499A3.525 3.525 0 006.532 10a3.525 3.525 0 003.5 3.501A3.526 3.526 0 0013.533 10a3.526 3.526 0 00-3.501-3.501z" fill-opacity="1"></path>

&#x20;   <path d="M8.582 15.386a2.537 2.537 0 00-1.11 2.084 2.547 2.547 0 002.53 2.53 2.546 2.546 0 002.527-2.53 2.532 2.532 0 00-1.091-2.072c-.45.119-.921.184-1.407.185-.5-.001-.987-.07-1.449-.197zm8.89-7.916a2.538 2.538 0 00-2.057 1.069c.129.466.198.956.199 1.461a5.51 5.51 0 01-.199 1.461 2.538 2.538 0 002.057 1.069A2.546 2.546 0 0020.001 10a2.546 2.546 0 00-2.529-2.53zm-14.943 0A2.547 2.547 0 00-.001 10a2.547 2.547 0 002.53 2.53 2.541 2.541 0 002.103-1.136A5.532 5.532 0 014.451 10c.001-.481.064-.948.181-1.394A2.541 2.541 0 002.529 7.47zM10.002 0a2.547 2.547 0 00-2.53 2.53A2.538 2.538 0 008.58 4.614c.463-.127.95-.196 1.451-.197.486.001.958.066 1.408.185a2.536 2.536 0 001.09-2.072A2.546 2.546 0 0010.002 0z" fill-opacity=".45"></path>

&#x20; </g>

</svg>

&#x20;                 <span class="font-medium text-navy-900 truncate">Personal</span>

&#x20;                 <span class="shrink-0 text-\[10px] font-semibold uppercase tracking-wider text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded">

&#x20;                   Current

&#x20;                 </span>

&#x20;               </div>

&#x20;               <div class="ml-\[26px] mt-1 flex items-center gap-1.5 flex-wrap">

&#x20;                 

&#x20; <span class="inline-block h-4 w-20 bg-navy-100 rounded-full animate-pulse"></span>

&#x20; <span class="inline-block h-4 w-14 bg-navy-100 rounded-full animate-pulse"></span>



&#x20;               </div>

&#x20;             </a>



&#x20;             

&#x20;             <div class="border-t border-navy-100">

&#x20;               <a href="/organizations/new" data-phx-link="redirect" data-phx-link-state="push" id="org-palette-item-1" class="flex items-center gap-2.5 px-4 py-3 text-sm transition-colors cursor-pointer border-l-2 border-transparent text-navy-600 hover:bg-navy-50">

&#x20;                 <span class="hero-plus-mini w-4 h-4 text-violet-500"></span>

&#x20;                 <span>Create new organization</span>

&#x20;               </a>

&#x20;             </div>

&#x20;           </div>



&#x20;           

&#x20;           <div class="hidden sm:flex items-center gap-3 px-4 py-2.5 border-t border-navy-100 text-\[11px] text-navy-400">

&#x20;             <span class="flex items-center gap-1">

&#x20;               <kbd class="px-1.5 py-0.5 bg-navy-100 rounded text-\[10px] font-mono">↑</kbd>

&#x20;               <kbd class="px-1.5 py-0.5 bg-navy-100 rounded text-\[10px] font-mono">↓</kbd>

&#x20;               navigate

&#x20;             </span>

&#x20;             <span class="flex items-center gap-1">

&#x20;               <kbd class="px-1.5 py-0.5 bg-navy-100 rounded text-\[10px] font-mono">↵</kbd>

&#x20;               select

&#x20;             </span>

&#x20;             <span class="flex items-center gap-1">

&#x20;               <kbd class="px-1.5 py-0.5 bg-navy-100 rounded text-\[10px] font-mono">esc</kbd>

&#x20;               close

&#x20;             </span>

&#x20;           </div>

&#x20;         </div>

&#x20;       </div>

&#x20;     </div>

&#x20;   </div>

&#x20; </div>

</div>





&#x20; 

&#x20; 



<button type="button" class="gap-2 btn gap-2 btn btn btn-purple btn-border-dark w-full" phx-click="\[\[\&quot;show\&quot;,{\&quot;to\&quot;:\&quot;#gh-launch-modal\&quot;}],\[\&quot;show\&quot;,{\&quot;to\&quot;:\&quot;#gh-launch-modal-bg\&quot;,\&quot;transition\&quot;:\[\[\&quot;transition-all\&quot;,\&quot;transform\&quot;,\&quot;ease-out\&quot;,\&quot;duration-300\&quot;],\[\&quot;opacity-0\&quot;],\[\&quot;opacity-100\&quot;]]}],\[\&quot;show\&quot;,{\&quot;to\&quot;:\&quot;#gh-launch-modal-container\&quot;,\&quot;transition\&quot;:\[\[\&quot;transition-all\&quot;,\&quot;transform\&quot;,\&quot;ease-out\&quot;,\&quot;duration-300\&quot;],\[\&quot;opacity-0\&quot;,\&quot;translate-y-4\&quot;,\&quot;sm:translate-y-0\&quot;,\&quot;sm:scale-95\&quot;],\[\&quot;opacity-100\&quot;,\&quot;translate-y-0\&quot;,\&quot;sm:scale-100\&quot;]]}],\[\&quot;add\_class\&quot;,{\&quot;names\&quot;:\[\&quot;overflow-hidden\&quot;],\&quot;to\&quot;:\&quot;body\&quot;}],\[\&quot;focus\_first\&quot;,{\&quot;to\&quot;:\&quot;#gh-launch-modal-content\&quot;}]]">

&#x20; 



&#x20;   

&#x20;   

<svg role="img" class="mr-2" style="pointer-events: none; width: 16px; height: 16px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">





&#x20;     <path d="M5.34 7.595L1.331 9.436a.564.564 0 000 1.023l4.009 1.842 1.841 4.008a.564.564 0 001.023 0l1.842-4.008 4.009-1.842a.564.564 0 000-1.023l-4.009-1.841-1.842-4.009a.562.562 0 00-1.023 0L5.34 7.595z" fill-opacity="1"></path>

&#x20;     <path d="M14.476 3.168l-2.004.921a.28.28 0 000 .511l2.004.921.921 2.004a.282.282 0 00.511 0l.921-2.004 2.004-.921a.282.282 0 000-.511l-2.004-.921-.921-2.004a.28.28 0 00-.511 0l-.921 2.004zM14.476 14.479l-2.004.921a.282.282 0 000 .511l2.004.921.921 2.004a.282.282 0 00.511 0l.921-2.004 2.004-.921a.28.28 0 000-.511l-2.004-.921-.921-2.004a.28.28 0 00-.511 0l-.921 2.004z" fill-opacity=".45"></path>



&#x20; </g>

</svg> Launch an App

&#x20; 

&#x20; 



</button>







<nav class="bg-navy-950/95 backdrop-blur-md lg:backdrop-blur-none lg:bg-transparent fixed lg:static bottom-0 left-0 flex items-center gap-0.5 lg:block w-full max-w-full min-w-\[11rem] px-1 sm:px-2 lg:px-0 overflow-x-auto lg:overflow-x-visible z-\[9999] lg:z-10 pb-\[env(safe-area-inset-bottom)] lg:pb-0 h-\[calc(3rem+env(safe-area-inset-bottom))] lg:h-auto text-\[10px] lg:text-sm text-white/80 lg:text-navy-900 font-medium">

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white bg-violet-600/90 lg:bg-violet-500/10 lg:text-violet-700">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         

<svg role="img" class="lg:text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">





&#x20;     <path d="M5.34 7.595L1.331 9.436a.564.564 0 000 1.023l4.009 1.842 1.841 4.008a.564.564 0 001.023 0l1.842-4.008 4.009-1.842a.564.564 0 000-1.023l-4.009-1.841-1.842-4.009a.562.562 0 00-1.023 0L5.34 7.595z" fill-opacity="1"></path>

&#x20;     <path d="M14.476 3.168l-2.004.921a.28.28 0 000 .511l2.004.921.921 2.004a.282.282 0 00.511 0l.921-2.004 2.004-.921a.282.282 0 000-.511l-2.004-.921-.921-2.004a.28.28 0 00-.511 0l-.921 2.004zM14.476 14.479l-2.004.921a.282.282 0 000 .511l2.004.921.921 2.004a.282.282 0 00.511 0l.921-2.004 2.004-.921a.28.28 0 000-.511l-2.004-.921-.921-2.004a.28.28 0 00-.511 0l-.921 2.004z" fill-opacity=".45"></path>



&#x20; </g>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Apps

&#x20;       </span>



&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com/team" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         <svg role="img" class="text-violet-500" viewBox="0 0 24 24" style="pointer-events: none; width: 14px; height: 14px; ;" fill="currentColor">

&#x20; <circle cx="14" cy="7" fill-opacity=".45" r="4"></circle>

&#x20; <path d="M12 13C8.68629 13 6 15.6863 6 19C6 20.1046 6.89543 21 8 21H20C21.1046 21 22 20.1046 22 19V18C22 15.2386 19.7614 13 17 13H12Z" fill-opacity=".45"></path>

&#x20; <path d="M7 13C4.23858 13 2 15.2386 2 18V19C2 20.1046 2.89543 21 4 21H16C17.1046 21 18 20.1046 18 19V18C18 15.2386 15.7614 13 13 13H7Z"></path>

&#x20; <circle cx="10" cy="7" r="4"></circle>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Team

&#x20;       </span>



&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <hr class="hidden lg:block my-3 w-full h-px border-0 bg-gradient-to-r from-violet-800/5 via-violet-800/20 to-violet-800/5">

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com/activity" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         <svg role="img" class="text-violet-500" viewBox="0 0 20 20" style="pointer-events: none; width: 14px; height: 14px; ;" fill="currentColor">

&#x20; <g buffered-rendering="static">

&#x20;   <path d="M4 18c-1.097 0-2-.903-2-2s.903-2 2-2h12c1.097 0 2 .903 2 2s-.903 2-2 2H4z" fill-opacity="1"></path>

&#x20;   <path d="M6 12c-1.097 0-2-.903-2-2s.903-2 2-2h8c1.097 0 2 .903 2 2s-.903 2-2 2H6z" fill-opacity=".65"></path>

&#x20;   <path d="M8 6c-1.097 0-2-.903-2-2s.903-2 2-2h4c1.097 0 2 .903 2 2s-.903 2-2 2H8z" fill-opacity=".45"></path>

&#x20; </g>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Activity

&#x20;       </span>



&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="https://fly-metrics.net/d/fly-app/fly-app?orgId=1635889" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900" target="\_blank">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         <svg role="img" class="text-violet-500" viewBox="0 0 20 20" style="pointer-events: none; width: 14px; height: 14px; ;" fill="currentColor">

&#x20; <g buffered-rendering="static" fill-rule="evenodd">

&#x20;   <path d="M1 11.759v4.385a2.847 2.847 0 002.846 2.846h12.308A2.847 2.847 0 0019 16.144v-4.385h-4.038c-.421 0-.797-.262-.943-.657l-1.16-2.477-2.051 6.291c-.253.967-1.612 1.01-1.925.06L6.955 9.893l-.494 1.235a1.003 1.003 0 01-.933.631H1zM1 9.75h3.848l1.257-3.142c.348-.871 1.593-.831 1.886.057l1.739 4.518 1.997-6.099c.249-.952 1.58-1.013 1.915-.087l2.02 4.753H19V3.856a2.847 2.847 0 00-2.846-2.846H3.846A2.847 2.847 0 001 3.856V9.75z" fill-opacity=".45"></path>

&#x20;   <path d="M1 9.75v2.009h4.528c.411 0 .781-.249.933-.631l.494-1.235 1.928 5.083c.313.95 1.672.907 1.925-.06l2.051-6.291 1.16 2.477c.146.395.522.657.943.657H19V9.75h-3.338l-2.02-4.753c-.335-.926-1.666-.865-1.915.087L9.73 11.183 7.991 6.665c-.293-.888-1.538-.928-1.886-.057L4.848 9.75H1z" fill-opacity="1"></path>

&#x20; </g>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Grafana

&#x20;       </span>



&#x20;       



&#x20;       

&#x20;         

<svg role="img" class="hidden lg:block text-violet-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" style="pointer-events: none; width: 16px; height: 16px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g bufferred-rendering="static">

&#x20;   <path d="M13.856 1.787H6.144a4.361 4.361 0 00-4.357 4.357v7.712a4.361 4.361 0 004.357 4.357h7.712a4.361 4.361 0 004.357-4.357V6.144a4.361 4.361 0 00-4.357-4.357z" fill-opacity=".2"></path>

&#x20;   <path d="M13.441 5.764H8.963a.793.793 0 00-.796.795c0 .433.363.796.796.796h2.541L5.816 13.06a.794.794 0 000 1.124.81.81 0 00.57.242.813.813 0 00.571-.242l5.688-5.688v2.541c0 .45.364.796.796.796a.793.793 0 00.795-.796V6.559a.783.783 0 00-.795-.795z"></path>

&#x20; </g>

</svg>

&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <hr class="hidden lg:block my-3 w-full h-px border-0 bg-gradient-to-r from-violet-800/5 via-violet-800/20 to-violet-800/5">

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com/managed\_postgres" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900" data-postgres="1">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25.6 25.6" style="pointer-events: none; width: 14px; height: 14px; ;" class="h-6 w-6 text-violet-500" fill="currentColor">

&#x20; <g fill="none" stroke="none">

&#x20;   

&#x20;   <path d="M23.535 15.6c-2.89.596-3.1-.383-3.1-.383 3.053-4.53 4.33-10.28 3.228-11.687-3.004-3.84-8.205-2.023-8.292-1.976l-.028.005a10.31 10.31 0 0 0-1.929-.201c-1.308-.02-2.3.343-3.054.914 0 0-9.278-3.822-8.846 4.807.092 1.836 2.63 13.9 5.66 10.25C8.29 15.987 9.36 14.86 9.36 14.86c.53.353 1.167.533 1.834.468l.052-.044a2.02 2.02 0 0 0 .021.518c-.78.872-.55 1.025-2.11 1.346-1.578.325-.65.904-.046 1.056.734.184 2.432.444 3.58-1.162l-.046.183c.306.245.52 1.593.484 2.815s-.06 2.06.18 2.716.48 2.13 2.53 1.7c1.713-.367 2.6-1.32 2.725-2.906.088-1.128.286-.962.3-1.97l.16-.478c.183-1.53.03-2.023 1.085-1.793l.257.023c.777.035 1.794-.125 2.39-.402 1.285-.596 2.047-1.592.78-1.33z" fill="currentColor" fill-opacity=".55"></path>

&#x20;   

&#x20;   <g stroke="currentColor" fill="none">

&#x20;     <path d="M12.814 16.467c-.08 2.846.02 5.712.298 6.4s.875 2.05 2.926 1.612c1.713-.367 2.337-1.078 2.607-2.647l.633-5.017M10.356 2.2S1.072-1.596 1.504 7.033c.092 1.836 2.63 13.9 5.66 10.25C8.27 15.95 9.27 14.907 9.27 14.907m6.1-13.4c-.32.1 5.164-2.005 8.282 1.978 1.1 1.407-.175 7.157-3.228 11.687"></path>

&#x20;     <path d="M20.425 15.17s.2.98 3.1.382c1.267-.262.504.734-.78 1.33-1.054.49-3.418.615-3.457-.06-.1-1.745 1.244-1.215 1.147-1.652-.088-.394-.69-.78-1.086-1.744-.347-.84-4.76-7.29 1.224-6.333.22-.045-1.56-5.7-7.16-5.782S7.99 8.196 7.99 8.196" stroke-linejoin="bevel"></path>

&#x20;     <path d="M11.247 15.768c-.78.872-.55 1.025-2.11 1.346-1.578.325-.65.904-.046 1.056.734.184 2.432.444 3.58-1.163.35-.49-.002-1.27-.482-1.468-.232-.096-.542-.216-.94.23z"></path>

&#x20;     <path d="M11.196 15.753c-.08-.513.168-1.122.433-1.836.398-1.07 1.316-2.14.582-5.537-.547-2.53-4.22-.527-4.22-.184s.166 1.74-.06 3.365c-.297 2.122 1.35 3.916 3.246 3.733"></path>

&#x20;     <path d="M20.562 7.095c.05.92-.198 1.545-.23 2.524-.046 1.422.678 3.05-.413 4.68"></path>

&#x20;   </g>

&#x20;   

&#x20;   <g fill="currentColor">

&#x20;     <path d="M10.322 8.145c-.017.117.215.43.516.472s.558-.202.575-.32-.215-.246-.516-.288-.56.02-.575.136z"></path>

&#x20;     <path d="M19.486 7.906c.016.117-.215.43-.516.472s-.56-.202-.575-.32.215-.246.516-.288.56.02.575.136z"></path>

&#x20;   </g>

&#x20; </g>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Managed Postgres

&#x20;       </span>



&#x20;       

&#x20;         

&#x20;   

&#x20; 

&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com/flynet" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         <svg viewBox="0 0 428 429" fill-rule="evenodd" role="img" style="pointer-events: none; width: 14px; height: 14px; ;" class="h-6 w-6 text-violet-500" aria-label="Phoenix.new Logo">

&#x20; <path d="M214.182 0c118.21 0 214.182 95.972 214.182 214.182s-95.972 214.182-214.182 214.182S0 332.392 0 214.182 95.972 0 214.182 0zm0 20.184c107.07 0 193.998 86.927 193.998 193.998 0 107.07-86.928 193.998-193.998 193.998-107.071 0-193.998-86.928-193.998-193.998 0-107.071 86.927-193.998 193.998-193.998zm6.88 42.755c-.876 1.536-2.359 1.328-2.391 1.335-20.467 4.171-134.504 23.594-126.939 139.823 2.734 42.014 35.449 70.669 52.96 78.805 18.456 8.576 65.198 20.229 96.05-17.115 15.526-18.794 14.649-54.023-.612-59.802-17.887-6.774-19.887 9.482-27.302 8.706-6.45-.675-10.776-13.494-5.937-24.058 3.377-7.374 16.59-14.027 28.579-13.484 34.96 1.582 60.423 35.87 48.407 85.019-5.574 22.796-27.891 55.725-71.249 64.517-43.284 8.778-88.306-5.769-124.158-58.084-.742-1.083-4.878 1.576 11.96 26.446 17.861 26.378 44.929 49.688 85.669 61.287 5.487 1.562 11.883 3.284 9.714 4.515-24.896 14.139-90.697-14.6-120.541-63.317-27.599-45.052-23.137-81.39-22.469-99.467 1.56-42.251 36.47-120.107 115.168-137.873 34.662-7.825 55.993-2.343 53.091 2.747zm36.52 286.976c0-1.628 1.233-2.144 1.259-2.157 14.406-7.603 99.993-81.622 42.978-171.135-20.61-32.357-53.694-37.438-71.784-37.438-18.091 0-66.638 9.145-66.638 57.488 0 37.326 33.22 50.175 47.377 49.614a3.179 3.179 0 013.572 2.475l.015.013c.048.229.071.462.064.696l-.049.46a3.157 3.157 0 01-.505 1.276c-6.315 10.399-64.627 18.13-82.191-31.969-7.095-20.237-10.896-54.175 13.964-82.977 28.618-33.156 91.117-57.958 145.358-17.821 86.088 63.705 62.268 176.634 3.48 219.18-19.471 14.091-36.9 17.69-36.9 12.295zm77.094-253.627c12.923 11.547 18.724 26.172 12.946 32.638-5.778 6.466-20.96 2.34-33.883-9.207-12.923-11.548-18.724-26.172-12.946-32.638 5.778-6.466 20.96-2.34 33.883 9.207z" fill="currentColor"></path>

&#x20; 

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         phoenix.new

&#x20;       </span>



&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com/redis" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         <svg role="img" class="text-violet-500" viewBox="0 0 20 20" style="pointer-events: none; width: 14px; height: 14px; ;" fill="currentColor">

&#x20; <path d="M3.616 16.384A7.223 7.223 0 1013.831 6.169l-1.277 1.277a5.42 5.42 0 010 7.662 5.42 5.42 0 01-7.662 0l-1.276 1.276zm2.553-2.553a3.613 3.613 0 005.108-5.108L10 10a1.806 1.806 0 01-2.554 2.554l-1.277 1.277z"></path>

&#x20; <path d="M16.384 3.616A7.223 7.223 0 106.169 13.831l1.277-1.277a5.418 5.418 0 017.661-7.661l1.277-1.277zm-2.553 2.553a3.613 3.613 0 00-5.108 5.108L10 10a1.806 1.806 0 012.554-2.554l1.277-1.277z" fill-opacity=".5"></path>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Upstash Redis

&#x20;       </span>



&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com/tigris" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         



<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="-0.5 -0.5 16.5 14.5" fill="currentColor">



&#x20; <path d="M5.927 6.043V2.825h3.052V.198H.09v2.627h2.661v3.204c0 3.277 1.392 7.101 6.226 7.101v-2.544c-2.469.014-3.051-1.885-3.051-4.543h.001z" fill-opacity=".85"></path>



&#x20; <path d="M13.451 4.07l-.321-.703a1.794 1.794 0 00-.909-.891l-.711-.3.701-.321c.401-.182.72-.506.894-.911l.306-.708.322.698c.181.401.507.719.913.891l.706.305-.7.32c-.401.182-.72.507-.895.911l-.306.709z" fill-opacity=".65"></path>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Tigris Object Storage

&#x20;       </span>



&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com/postgres" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25.6 25.6" style="pointer-events: none; width: 14px; height: 14px; ;" class="h-6 w-6 text-violet-500" fill="currentColor">

&#x20; <g fill="none" stroke="none">

&#x20;   

&#x20;   <path d="M23.535 15.6c-2.89.596-3.1-.383-3.1-.383 3.053-4.53 4.33-10.28 3.228-11.687-3.004-3.84-8.205-2.023-8.292-1.976l-.028.005a10.31 10.31 0 0 0-1.929-.201c-1.308-.02-2.3.343-3.054.914 0 0-9.278-3.822-8.846 4.807.092 1.836 2.63 13.9 5.66 10.25C8.29 15.987 9.36 14.86 9.36 14.86c.53.353 1.167.533 1.834.468l.052-.044a2.02 2.02 0 0 0 .021.518c-.78.872-.55 1.025-2.11 1.346-1.578.325-.65.904-.046 1.056.734.184 2.432.444 3.58-1.162l-.046.183c.306.245.52 1.593.484 2.815s-.06 2.06.18 2.716.48 2.13 2.53 1.7c1.713-.367 2.6-1.32 2.725-2.906.088-1.128.286-.962.3-1.97l.16-.478c.183-1.53.03-2.023 1.085-1.793l.257.023c.777.035 1.794-.125 2.39-.402 1.285-.596 2.047-1.592.78-1.33z" fill="currentColor" fill-opacity=".55"></path>

&#x20;   

&#x20;   <g stroke="currentColor" fill="none">

&#x20;     <path d="M12.814 16.467c-.08 2.846.02 5.712.298 6.4s.875 2.05 2.926 1.612c1.713-.367 2.337-1.078 2.607-2.647l.633-5.017M10.356 2.2S1.072-1.596 1.504 7.033c.092 1.836 2.63 13.9 5.66 10.25C8.27 15.95 9.27 14.907 9.27 14.907m6.1-13.4c-.32.1 5.164-2.005 8.282 1.978 1.1 1.407-.175 7.157-3.228 11.687"></path>

&#x20;     <path d="M20.425 15.17s.2.98 3.1.382c1.267-.262.504.734-.78 1.33-1.054.49-3.418.615-3.457-.06-.1-1.745 1.244-1.215 1.147-1.652-.088-.394-.69-.78-1.086-1.744-.347-.84-4.76-7.29 1.224-6.333.22-.045-1.56-5.7-7.16-5.782S7.99 8.196 7.99 8.196" stroke-linejoin="bevel"></path>

&#x20;     <path d="M11.247 15.768c-.78.872-.55 1.025-2.11 1.346-1.578.325-.65.904-.046 1.056.734.184 2.432.444 3.58-1.163.35-.49-.002-1.27-.482-1.468-.232-.096-.542-.216-.94.23z"></path>

&#x20;     <path d="M11.196 15.753c-.08-.513.168-1.122.433-1.836.398-1.07 1.316-2.14.582-5.537-.547-2.53-4.22-.527-4.22-.184s.166 1.74-.06 3.365c-.297 2.122 1.35 3.916 3.246 3.733"></path>

&#x20;     <path d="M20.562 7.095c.05.92-.198 1.545-.23 2.524-.046 1.422.678 3.05-.413 4.68"></path>

&#x20;   </g>

&#x20;   

&#x20;   <g fill="currentColor">

&#x20;     <path d="M10.322 8.145c-.017.117.215.43.516.472s.558-.202.575-.32-.215-.246-.516-.288-.56.02-.575.136z"></path>

&#x20;     <path d="M19.486 7.906c.016.117-.215.43-.516.472s-.56-.202-.575-.32.215-.246.516-.288.56.02.575.136z"></path>

&#x20;   </g>

&#x20; </g>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Legacy Postgres

&#x20;       </span>



&#x20;       

&#x20;         

&#x20;   <div class="bubble-wrap inline-block hidden md:inline-block">

&#x20; 

&#x20;     <span class="hero-information-circle-mini size-4 text-navy-400"></span>

&#x20;     



&#x20; <div class="bubble-r tail max-w-xs">

&#x20;   

&#x20;       Legacy Postgres clusters are unmanaged and require manual configuration

&#x20;     

&#x20; </div>

</div>

&#x20; 

&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <hr class="hidden lg:block my-3 w-full h-px border-0 bg-gradient-to-r from-violet-800/5 via-violet-800/20 to-violet-800/5">

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com/status" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         

<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor">

&#x20; <g buffered-rendering="static">

&#x20;   <path d="M16.437 10.588a2.354 2.354 0 00-2.352-2.354h-8.17a2.354 2.354 0 00-2.352 2.354v7.059A2.353 2.353 0 005.915 20h8.17a2.353 2.353 0 002.352-2.353v-7.059zm-1.809-5.987h-1.332a.465.465 0 100 .93h1.332a.465.465 0 100-.93zm-9.235.93h1.333a.465.465 0 000-.93H5.393a.465.465 0 000 .93zm7.542-4.054l-.942.942a.465.465 0 10.658.658l.942-.943a.465.465 0 10-.658-.657zm-6.507.657l.942.943a.465.465 0 00.658-.658l-.942-.942a.465.465 0 10-.658.657zM9.529.465v1.332a.465.465 0 00.931 0V.465a.466.466 0 00-.931 0z" fill-opacity=".5"></path>

&#x20;   <path d="M7.25 15.033a.464.464 0 00-.463.529c.229 1.641 1.591 2.894 3.224 2.894 1.623 0 2.978-1.237 3.22-2.864a.463.463 0 00-.458-.533l-5.523-.026zm-3.687 1.271v-4.373a2.187 2.187 0 000 4.373zm12.874-4.373v4.373a2.187 2.187 0 000-4.373zm-3.896-1.225a1.388 1.388 0 10.001 2.773 1.388 1.388 0 00-.001-2.773zm-5.165 2.772l.071.002a1.387 1.387 0 10-.071-.002zm2.635-10.015a1.62 1.62 0 10.002 3.24 1.62 1.62 0 00-.002-3.24z"></path>

&#x20; </g>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Status

&#x20;       </span>



&#x20;       

&#x20;         

&#x20;   

&#x20; 

&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com/support" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         

<svg role="img" class="text-violet-500" style="pointer-events: none; width: 14px; height: 14px; " viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd">

&#x20; <g bufferred-rendering="static">

&#x20;   <path d="M3.267 12.067A3.269 3.269 0 010 8.8V3.267A3.269 3.269 0 013.267 0h10.581a3.269 3.269 0 013.267 3.267V8.8a3.269 3.269 0 01-3.267 3.267h-5.42l-3.313 2.651s-1.441 1.233-1.441-.218v-2.433h-.407z"></path>

&#x20;   <path d="M18.615 8.458V8.8a4.77 4.77 0 01-4.767 4.767H8.954L6.72 15.354a2.54 2.54 0 002.517 2.206h4.213l2.575 2.06s1.12.958 1.12-.169V17.56h.316A2.54 2.54 0 0020 15.021V10.72a2.54 2.54 0 00-1.385-2.262z" fill-opacity=".5"></path>

&#x20; </g>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Support

&#x20;       </span>



&#x20;       

&#x20;         

&#x20;   

&#x20;     <span class="hidden lg:inline-block ml-1 px-1.5 py-0.5 text-\[10px] font-bold text-white bg-violet-600 rounded-full">

&#x20;       FREE TRIAL

&#x20;     </span>

&#x20;   

&#x20; 

&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com/compliance" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         <svg role="img" class="text-violet-500" viewBox="0 0 24 24" style="pointer-events: none; width: 14px; height: 14px; ;" fill="currentColor">

&#x20; <path d="M3 9C3 7.34315 4.34315 6 6 6H12.7574C13.553 6 14.3161 6.31607 14.8787 6.87868L16.1213 8.12132C16.6839 8.68393 17 9.44699 17 10.2426V19C17 20.6569 15.6569 22 14 22H6C4.34315 22 3 20.6569 3 19V9Z" fill-opacity=".45"></path>

&#x20; <path d="M7 5C7 3.34315 8.34315 2 10 2H15.7574C16.553 2 17.3161 2.31607 17.8787 2.87868L20.1213 5.12132C20.6839 5.68393 21 6.44699 21 7.24264V15C21 16.6569 19.6569 18 18 18H10C8.34315 18 7 16.6569 7 15V5Z" fill-opacity="1"></path>

&#x20; <path d="M16 5V2C16.6403 2 17.2544 2.25435 17.7071 2.70711L20.2929 5.29289C20.7456 5.74565 21 6.35971 21 7H18C16.8954 7 16 6.10457 16 5Z" fill-opacity=".35"></path>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Compliance

&#x20;       </span>



&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com/tokens" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         <svg role="img" class="text-violet-500" viewBox="0 0 20 20" style="pointer-events: none; width: 14px; height: 14px; ;" fill="currentColor" fill-rule="evenodd">

&#x20; <g buffered-rendering="static">

&#x20;   

&#x20;     <path d="M19 10a9 9 0 11-18 0 9 9 0 0118 0z" fill-opacity=".5"></path>

&#x20;     <path d="M12.435 7.913a2.435 2.435 0 00-4.87 0c0 .965.562 1.796 1.375 2.19l-.679 4.419h3.478l-.68-4.419a2.433 2.433 0 001.376-2.19z" fill-opacity="1"></path>

&#x20;   

&#x20; </g>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Tokens

&#x20;       </span>



&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <hr class="hidden lg:block my-3 w-full h-px border-0 bg-gradient-to-r from-violet-800/5 via-violet-800/20 to-violet-800/5">

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com/usage" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         <svg role="img" class="text-violet-500" viewBox="0 0 20 20" style="pointer-events: none; width: 14px; height: 14px; ;" fill="currentColor">

&#x20; <g buffered-rendering="static">

&#x20;   <path d="M18 4c0-1.097-.903-2-2-2s-2 .903-2 2v12c0 1.097.903 2 2 2s2-.903 2-2V4z" fill-opacity="1"></path>

&#x20;   <path d="M6 14c0-1.097-.903-2-2-2s-2 .903-2 2v2c0 1.097.903 2 2 2s2-.903 2-2v-2z" fill-opacity=".45"></path>

&#x20;   <path d="M12 8c0-1.097-.903-2-2-2s-2 .903-2 2v8c0 1.097.903 2 2 2s2-.903 2-2V8z" fill-opacity=".65"></path>

&#x20; </g>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Usage

&#x20;       </span>



&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com/billing" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         <svg role="img" class="text-violet-500" viewBox="0 0 24 24" style="pointer-events: none; width: 14px; height: 14px; ;" fill="currentColor">

&#x20; <g id="card">

&#x20;   <rect fill="none" height="24" width="24"></rect>

&#x20;   <path d="M21,19H3c-1.1,0-2-0.9-2-2V6c0-1.1,0.9-2,2-2h18c1.1,0,2,0.9,2,2v11C23,18.1,22.1,19,21,19z" opacity="0.45"></path>

&#x20;   <rect height="3" width="22" x="1" y="7"></rect>

&#x20;   <path d="M19,16h-8c-0.6,0-1-0.4-1-1v0c0-0.6,0.4-1,1-1h8c0.6,0,1,0.4,1,1v0C20,15.6,19.6,16,19,16z" opacity="0.45"></path>

&#x20; </g>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Billing

&#x20;       </span>



&#x20;       

&#x20;         

&#x20;   

&#x20; 

&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

&#x20;   

&#x20;     <a href="/dashboard/dublinsistemas-gmail-com/settings" data-phx-link="redirect" data-phx-link-state="push" class="group w-14 lg:w-auto shrink-0 lg:shrink flex flex-col lg:flex-row gap-0.5 lg:gap-2.5 items-center justify-items-center lg:justify-items-start px-1 py-1 lg:px-2.5 lg:py-2 rounded-lg transition-colors text-white/60 hover:text-white lg:hover:bg-transparent lg:hover:text-violet-600 lg:text-navy-900">

&#x20;       <span class="w-5 h-5 lg:w-6 lg:h-6 flex items-center justify-center shrink-0 \[\&>svg]:!w-3.5 \[\&>svg]:!h-3.5 lg:\[\&>svg]:!w-3.5 lg:\[\&>svg]:!h-3.5 lg:bg-gradient-to-b lg:from-white/75 lg:to-violet-100/75 lg:rounded-md lg:shadow-sm lg:shadow-violet-800/10 lg:ring-1 lg:ring-violet-800/10">

&#x20;         <svg role="img" class="text-violet-500" viewBox="0 0 20 20" style="pointer-events: none; width: 14px; height: 14px; ;" fill="currentColor">

&#x20; <g buffered-rendering="static">

&#x20;   <path d="M5.48 17.979h9.04A3.317 3.317 0 0018 14.682a3.317 3.317 0 00-3.48-3.297H5.48A3.317 3.317 0 002 14.682a3.317 3.317 0 003.302 3.301l.178-.004zm0-9.381h9.04A3.318 3.318 0 0018 5.301a3.318 3.318 0 00-3.48-3.297H5.48A3.318 3.318 0 002 5.301a3.318 3.318 0 003.302 3.302l.178-.005z" fill-opacity=".45"></path>

&#x20;   <path d="M14.696 11.413h.019A3.3 3.3 0 0118 14.698a3.3 3.3 0 01-3.285 3.285 3.3 3.3 0 01-3.285-3.285v-.019a3.281 3.281 0 013.266-3.266zM5.343 1.992a3.3 3.3 0 013.228 3.285 3.301 3.301 0 01-3.286 3.285A3.3 3.3 0 012 5.277a3.301 3.301 0 013.285-3.286l.058.001z" fill-opacity="1"></path>

&#x20; </g>

</svg>

&#x20;       </span>

&#x20;       <span class="w-full lg:w-auto text-center lg:text-left truncate">

&#x20;         Settings

&#x20;       </span>



&#x20;       



&#x20;       

&#x20;     </a>

&#x20;   

&#x20; 

</nav>



<div class="sm:px-6 lg:px-0 ">

&#x20; 

&#x20; 

</div>

&#x20;   

&#x20; </div>



&#x20; <div class="flex-1 flex flex-col xl:flex-row xl:items-start gap-6">

&#x20;   <main class="card p-0 min-w-0 lg:flex-1">

&#x20;     

&#x20;   

&#x20; <form method="post" id="apps\_filters" class="contents" phx-change="update\_filters" phx-submit="update\_filters">

&#x20; 

&#x20; 

&#x20; 

&#x20;   <header class="px-4 py-4 border-b">

&#x20;     <div class="flex flex-wrap items-stretch justify-between gap-4">

&#x20;       <div class="flex flex-col">

&#x20;         <h1 class="text-2xl font-semibold text-gray-900">Apps</h1>

&#x20;         

&#x20;       </div>



&#x20;       <div class="flex flex-col gap-4 items-end">

&#x20;         <div class="w-full sm:w-\[320px]">

&#x20;           <label for="search" class="sr-only">Search</label>

&#x20;           <div class="relative w-full">

&#x20;             <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">

&#x20;               <span class="hero-magnifying-glass h-5 w-5 bg-gray-400"></span>

&#x20;             </div>

&#x20;             <input class="block w-full rounded-lg border-gray-300 pl-10 pr-8 focus:border-violet-500 focus:ring-violet-500 sm:text-sm" data-slash-to-focus id="apps\_filters\_name" name="apps\_search\[name]" phx-debounce="200" placeholder="Search apps..." type="text">

&#x20;             <div class="absolute inset-y-0 right-0 hidden sm:flex items-center pr-3 pointer-events-none">

&#x20;               <kbd class="inline-flex items-center rounded border border-gray-200 px-1.5 font-sans text-xs text-gray-400">

&#x20;                 /

&#x20;               </kbd>

&#x20;             </div>

&#x20;           </div>

&#x20;         </div>



&#x20;         <div>

&#x20;           <div class="flex items-center">



&#x20;             <input type="hidden" name="apps\_search\[statuses]\[]" value="">



&#x20;             <div class="flex items-center gap-2">







&#x20;                 <div class="relative cursor-pointer hidden md:inline-flex">

&#x20;                   <input id="statuses-deployed" name="apps\_search\[statuses]\[]" value="deployed" checked type="checkbox" class="sr-only peer pointer-events-none">

&#x20;                   <div phx-click="toggle\_status" phx-value-status="deployed" class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all bg-green-50 hover:bg-green-100 border-green-200 text-green-700">

&#x20;                     <span class="hero-check-circle h-3.5 w-3.5 text-green-700"></span>

&#x20;                     <span>Deployed</span>

&#x20;                     



&#x20;                       <svg class="h-3.5 w-3.5 text-green-700" viewBox="0 0 20 20" fill="currentColor">

&#x20;                         <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"></path>

&#x20;                       </svg>



&#x20;                   </div>

&#x20;                 </div>







&#x20;                 <div class="relative cursor-pointer hidden md:inline-flex">

&#x20;                   <input id="statuses-pending" name="apps\_search\[statuses]\[]" value="pending" checked type="checkbox" class="sr-only peer pointer-events-none">

&#x20;                   <div phx-click="toggle\_status" phx-value-status="pending" class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-700">

&#x20;                     <span class="hero-clock h-3.5 w-3.5 text-yellow-700"></span>

&#x20;                     <span>Pending</span>

&#x20;                     



&#x20;                       <svg class="h-3.5 w-3.5 text-yellow-700" viewBox="0 0 20 20" fill="currentColor">

&#x20;                         <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"></path>

&#x20;                       </svg>



&#x20;                   </div>

&#x20;                 </div>







&#x20;                 <div class="relative cursor-pointer hidden md:inline-flex">

&#x20;                   <input id="statuses-suspended" name="apps\_search\[statuses]\[]" value="suspended" checked type="checkbox" class="sr-only peer pointer-events-none">

&#x20;                   <div phx-click="toggle\_status" phx-value-status="suspended" class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700">

&#x20;                     <span class="hero-pause-circle h-3.5 w-3.5 text-gray-700"></span>

&#x20;                     <span>Suspended</span>

&#x20;                     



&#x20;                       <svg class="h-3.5 w-3.5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">

&#x20;                         <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"></path>

&#x20;                       </svg>



&#x20;                   </div>

&#x20;                 </div>



&#x20;             </div>

&#x20;           </div>



&#x20;           <div class="flex items-center gap-2 flex-wrap">







&#x20;               <div class="relative cursor-pointer inline-flex md:hidden">

&#x20;                 <input id="statuses-mobile-deployed" name="apps\_search\[statuses]\[]" value="deployed" checked type="checkbox" class="sr-only peer pointer-events-none">

&#x20;                 <div phx-click="toggle\_status" phx-value-status="deployed" class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all bg-green-50 hover:bg-green-100 border-green-200 text-green-700">

&#x20;                   <span class="hero-check-circle h-3.5 w-3.5 text-green-700"></span>

&#x20;                   <span>Deployed</span>

&#x20;                   



&#x20;                     <svg class="h-3.5 w-3.5 text-green-700" viewBox="0 0 20 20" fill="currentColor">

&#x20;                       <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"></path>

&#x20;                     </svg>



&#x20;                 </div>

&#x20;               </div>







&#x20;               <div class="relative cursor-pointer inline-flex md:hidden">

&#x20;                 <input id="statuses-mobile-pending" name="apps\_search\[statuses]\[]" value="pending" checked type="checkbox" class="sr-only peer pointer-events-none">

&#x20;                 <div phx-click="toggle\_status" phx-value-status="pending" class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-700">

&#x20;                   <span class="hero-clock h-3.5 w-3.5 text-yellow-700"></span>

&#x20;                   <span>Pending</span>

&#x20;                   



&#x20;                     <svg class="h-3.5 w-3.5 text-yellow-700" viewBox="0 0 20 20" fill="currentColor">

&#x20;                       <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"></path>

&#x20;                     </svg>



&#x20;                 </div>

&#x20;               </div>







&#x20;               <div class="relative cursor-pointer inline-flex md:hidden">

&#x20;                 <input id="statuses-mobile-suspended" name="apps\_search\[statuses]\[]" value="suspended" checked type="checkbox" class="sr-only peer pointer-events-none">

&#x20;                 <div phx-click="toggle\_status" phx-value-status="suspended" class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700">

&#x20;                   <span class="hero-pause-circle h-3.5 w-3.5 text-gray-700"></span>

&#x20;                   <span>Suspended</span>

&#x20;                   



&#x20;                     <svg class="h-3.5 w-3.5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">

&#x20;                       <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"></path>

&#x20;                     </svg>



&#x20;                 </div>

&#x20;               </div>



&#x20;           </div>

&#x20;         </div>

&#x20;       </div>

&#x20;     </div>



&#x20;     

&#x20;   </header>

&#x20; 

</form>



&#x20; <ul role="list" class="relative z-0">





&#x20;     <li class="sr-only">Loading...</li>

&#x20;     <li class="relative pl-4 pr-6 py-5 sm:py-6 sm:pl-6 lg:pl-8 xl:pl-6 border-b border-gray-200" aria-hidden="true">

&#x20;       <div class="flex items-center justify-between space-x-4">



&#x20;         <div class="min-w-0">

&#x20;           <div class="flex items-center space-x-3">

&#x20;             <span class="inline-block p-1 mr-1 rounded-full border-4 border-white/75 align-text-top bg-slate-400 ">

</span>



&#x20;             <span class="block">

&#x20;               <h2 class="text-sm font-medium">

&#x20;                 <div class="w-32 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;               </h2>

&#x20;             </span>

&#x20;           </div>

&#x20;         </div>

&#x20;         <div class="sm:hidden">



&#x20;           <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">

&#x20;             <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>

&#x20;           </svg>

&#x20;         </div>



&#x20;         <div class="hidden sm:flex flex-col flex-shrink-0 items-end">

&#x20;           <div class="w-40 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;         </div>

&#x20;       </div>

&#x20;     </li><li class="relative pl-4 pr-6 py-5 sm:py-6 sm:pl-6 lg:pl-8 xl:pl-6 border-b border-gray-200" aria-hidden="true">

&#x20;       <div class="flex items-center justify-between space-x-4">



&#x20;         <div class="min-w-0">

&#x20;           <div class="flex items-center space-x-3">

&#x20;             <span class="inline-block p-1 mr-1 rounded-full border-4 border-white/75 align-text-top bg-slate-400 ">

</span>



&#x20;             <span class="block">

&#x20;               <h2 class="text-sm font-medium">

&#x20;                 <div class="w-32 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;               </h2>

&#x20;             </span>

&#x20;           </div>

&#x20;         </div>

&#x20;         <div class="sm:hidden">



&#x20;           <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">

&#x20;             <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>

&#x20;           </svg>

&#x20;         </div>



&#x20;         <div class="hidden sm:flex flex-col flex-shrink-0 items-end">

&#x20;           <div class="w-40 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;         </div>

&#x20;       </div>

&#x20;     </li><li class="relative pl-4 pr-6 py-5 sm:py-6 sm:pl-6 lg:pl-8 xl:pl-6 border-b border-gray-200" aria-hidden="true">

&#x20;       <div class="flex items-center justify-between space-x-4">



&#x20;         <div class="min-w-0">

&#x20;           <div class="flex items-center space-x-3">

&#x20;             <span class="inline-block p-1 mr-1 rounded-full border-4 border-white/75 align-text-top bg-slate-400 ">

</span>



&#x20;             <span class="block">

&#x20;               <h2 class="text-sm font-medium">

&#x20;                 <div class="w-32 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;               </h2>

&#x20;             </span>

&#x20;           </div>

&#x20;         </div>

&#x20;         <div class="sm:hidden">



&#x20;           <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">

&#x20;             <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>

&#x20;           </svg>

&#x20;         </div>



&#x20;         <div class="hidden sm:flex flex-col flex-shrink-0 items-end">

&#x20;           <div class="w-40 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;         </div>

&#x20;       </div>

&#x20;     </li><li class="relative pl-4 pr-6 py-5 sm:py-6 sm:pl-6 lg:pl-8 xl:pl-6 border-b border-gray-200" aria-hidden="true">

&#x20;       <div class="flex items-center justify-between space-x-4">



&#x20;         <div class="min-w-0">

&#x20;           <div class="flex items-center space-x-3">

&#x20;             <span class="inline-block p-1 mr-1 rounded-full border-4 border-white/75 align-text-top bg-slate-400 ">

</span>



&#x20;             <span class="block">

&#x20;               <h2 class="text-sm font-medium">

&#x20;                 <div class="w-32 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;               </h2>

&#x20;             </span>

&#x20;           </div>

&#x20;         </div>

&#x20;         <div class="sm:hidden">



&#x20;           <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">

&#x20;             <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>

&#x20;           </svg>

&#x20;         </div>



&#x20;         <div class="hidden sm:flex flex-col flex-shrink-0 items-end">

&#x20;           <div class="w-40 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;         </div>

&#x20;       </div>

&#x20;     </li><li class="relative pl-4 pr-6 py-5 sm:py-6 sm:pl-6 lg:pl-8 xl:pl-6 border-b border-gray-200" aria-hidden="true">

&#x20;       <div class="flex items-center justify-between space-x-4">



&#x20;         <div class="min-w-0">

&#x20;           <div class="flex items-center space-x-3">

&#x20;             <span class="inline-block p-1 mr-1 rounded-full border-4 border-white/75 align-text-top bg-slate-400 ">

</span>



&#x20;             <span class="block">

&#x20;               <h2 class="text-sm font-medium">

&#x20;                 <div class="w-32 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;               </h2>

&#x20;             </span>

&#x20;           </div>

&#x20;         </div>

&#x20;         <div class="sm:hidden">



&#x20;           <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">

&#x20;             <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>

&#x20;           </svg>

&#x20;         </div>



&#x20;         <div class="hidden sm:flex flex-col flex-shrink-0 items-end">

&#x20;           <div class="w-40 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;         </div>

&#x20;       </div>

&#x20;     </li><li class="relative pl-4 pr-6 py-5 sm:py-6 sm:pl-6 lg:pl-8 xl:pl-6 border-b border-gray-200" aria-hidden="true">

&#x20;       <div class="flex items-center justify-between space-x-4">



&#x20;         <div class="min-w-0">

&#x20;           <div class="flex items-center space-x-3">

&#x20;             <span class="inline-block p-1 mr-1 rounded-full border-4 border-white/75 align-text-top bg-slate-400 ">

</span>



&#x20;             <span class="block">

&#x20;               <h2 class="text-sm font-medium">

&#x20;                 <div class="w-32 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;               </h2>

&#x20;             </span>

&#x20;           </div>

&#x20;         </div>

&#x20;         <div class="sm:hidden">



&#x20;           <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">

&#x20;             <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>

&#x20;           </svg>

&#x20;         </div>



&#x20;         <div class="hidden sm:flex flex-col flex-shrink-0 items-end">

&#x20;           <div class="w-40 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;         </div>

&#x20;       </div>

&#x20;     </li><li class="relative pl-4 pr-6 py-5 sm:py-6 sm:pl-6 lg:pl-8 xl:pl-6 border-b border-gray-200" aria-hidden="true">

&#x20;       <div class="flex items-center justify-between space-x-4">



&#x20;         <div class="min-w-0">

&#x20;           <div class="flex items-center space-x-3">

&#x20;             <span class="inline-block p-1 mr-1 rounded-full border-4 border-white/75 align-text-top bg-slate-400 ">

</span>



&#x20;             <span class="block">

&#x20;               <h2 class="text-sm font-medium">

&#x20;                 <div class="w-32 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;               </h2>

&#x20;             </span>

&#x20;           </div>

&#x20;         </div>

&#x20;         <div class="sm:hidden">



&#x20;           <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">

&#x20;             <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>

&#x20;           </svg>

&#x20;         </div>



&#x20;         <div class="hidden sm:flex flex-col flex-shrink-0 items-end">

&#x20;           <div class="w-40 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;         </div>

&#x20;       </div>

&#x20;     </li><li class="relative pl-4 pr-6 py-5 sm:py-6 sm:pl-6 lg:pl-8 xl:pl-6 border-b border-gray-200" aria-hidden="true">

&#x20;       <div class="flex items-center justify-between space-x-4">



&#x20;         <div class="min-w-0">

&#x20;           <div class="flex items-center space-x-3">

&#x20;             <span class="inline-block p-1 mr-1 rounded-full border-4 border-white/75 align-text-top bg-slate-400 ">

</span>



&#x20;             <span class="block">

&#x20;               <h2 class="text-sm font-medium">

&#x20;                 <div class="w-32 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;               </h2>

&#x20;             </span>

&#x20;           </div>

&#x20;         </div>

&#x20;         <div class="sm:hidden">



&#x20;           <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">

&#x20;             <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>

&#x20;           </svg>

&#x20;         </div>



&#x20;         <div class="hidden sm:flex flex-col flex-shrink-0 items-end">

&#x20;           <div class="w-40 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;         </div>

&#x20;       </div>

&#x20;     </li><li class="relative pl-4 pr-6 py-5 sm:py-6 sm:pl-6 lg:pl-8 xl:pl-6 border-b border-gray-200" aria-hidden="true">

&#x20;       <div class="flex items-center justify-between space-x-4">



&#x20;         <div class="min-w-0">

&#x20;           <div class="flex items-center space-x-3">

&#x20;             <span class="inline-block p-1 mr-1 rounded-full border-4 border-white/75 align-text-top bg-slate-400 ">

</span>



&#x20;             <span class="block">

&#x20;               <h2 class="text-sm font-medium">

&#x20;                 <div class="w-32 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;               </h2>

&#x20;             </span>

&#x20;           </div>

&#x20;         </div>

&#x20;         <div class="sm:hidden">



&#x20;           <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">

&#x20;             <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>

&#x20;           </svg>

&#x20;         </div>



&#x20;         <div class="hidden sm:flex flex-col flex-shrink-0 items-end">

&#x20;           <div class="w-40 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;         </div>

&#x20;       </div>

&#x20;     </li><li class="relative pl-4 pr-6 py-5 sm:py-6 sm:pl-6 lg:pl-8 xl:pl-6 border-b border-gray-200" aria-hidden="true">

&#x20;       <div class="flex items-center justify-between space-x-4">



&#x20;         <div class="min-w-0">

&#x20;           <div class="flex items-center space-x-3">

&#x20;             <span class="inline-block p-1 mr-1 rounded-full border-4 border-white/75 align-text-top bg-slate-400 ">

</span>



&#x20;             <span class="block">

&#x20;               <h2 class="text-sm font-medium">

&#x20;                 <div class="w-32 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;               </h2>

&#x20;             </span>

&#x20;           </div>

&#x20;         </div>

&#x20;         <div class="sm:hidden">



&#x20;           <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">

&#x20;             <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>

&#x20;           </svg>

&#x20;         </div>



&#x20;         <div class="hidden sm:flex flex-col flex-shrink-0 items-end">

&#x20;           <div class="w-40 bg-gray-300 h-5 rounded-md animate-pulse"></div>

&#x20;         </div>

&#x20;       </div>

&#x20;     </li>



&#x20;   



&#x20;       <div id="apps-list" phx-update="stream" class="">

&#x20;         

&#x20;       </div>





&#x20;   



&#x20;   



&#x20;   

&#x20; </ul>



&#x20;   

&#x20;   </main>



&#x20;   <aside class="space-y-6 xl:w-96">

&#x20;     

&#x20;     

&#x20;   



&#x20;   



&#x20;   



&#x20;   <div>

&#x20;     <div class="card p-0">

&#x20;       <div class="p-5 border-b border-gray-200">

&#x20;         <div class="flex items-center justify-between">

&#x20;           <h3 class="text-\[0.9375rem] font-medium text-navy-900">Recent Activity</h3>



&#x20;           

&#x20;         </div>

&#x20;       </div>

&#x20;       <div class="p-5">

&#x20;         

&#x20;             <div class="space-y-3">

&#x20;               <div class="space-y-1">

&#x20;                 <div class="w-24 bg-gray-200 h-3 rounded animate-pulse"></div>

&#x20;                 <div class="w-32 bg-gray-200 h-2 rounded animate-pulse"></div>

&#x20;               </div><div class="space-y-1">

&#x20;                 <div class="w-24 bg-gray-200 h-3 rounded animate-pulse"></div>

&#x20;                 <div class="w-32 bg-gray-200 h-2 rounded animate-pulse"></div>

&#x20;               </div><div class="space-y-1">

&#x20;                 <div class="w-24 bg-gray-200 h-3 rounded animate-pulse"></div>

&#x20;                 <div class="w-32 bg-gray-200 h-2 rounded animate-pulse"></div>

&#x20;               </div>

&#x20;             </div>

&#x20;           

&#x20;       </div>

&#x20;     </div>

&#x20;   </div>



&#x20;   

&#x20; 

&#x20;   

&#x20;   </aside>

&#x20; </div>

</div>



&#x20; <div id="gh-launch-modal" class="relative z-\[9999] hidden" phx-hook="LaunchModal" phx-remove="\[\[\&quot;hide\&quot;,{\&quot;to\&quot;:\&quot;#gh-launch-modal-bg\&quot;,\&quot;transition\&quot;:\[\[\&quot;transition-all\&quot;,\&quot;transform\&quot;,\&quot;ease-in\&quot;,\&quot;duration-200\&quot;],\[\&quot;opacity-100\&quot;],\[\&quot;opacity-0\&quot;]]}],\[\&quot;hide\&quot;,{\&quot;time\&quot;:200,\&quot;to\&quot;:\&quot;#gh-launch-modal-container\&quot;,\&quot;transition\&quot;:\[\[\&quot;transition-all\&quot;,\&quot;transform\&quot;,\&quot;ease-in\&quot;,\&quot;duration-200\&quot;],\[\&quot;opacity-100\&quot;,\&quot;translate-y-0\&quot;,\&quot;sm:scale-100\&quot;],\[\&quot;opacity-0\&quot;,\&quot;translate-y-4\&quot;,\&quot;sm:translate-y-0\&quot;,\&quot;sm:scale-95\&quot;]]}],\[\&quot;hide\&quot;,{\&quot;to\&quot;:\&quot;#gh-launch-modal\&quot;,\&quot;transition\&quot;:\[\[\&quot;block\&quot;],\[\&quot;block\&quot;],\[\&quot;hidden\&quot;]]}],\[\&quot;remove\_class\&quot;,{\&quot;names\&quot;:\[\&quot;overflow-hidden\&quot;],\&quot;to\&quot;:\&quot;body\&quot;}],\[\&quot;pop\_focus\&quot;,{}]]" data-cancel="\[\[\&quot;hide\&quot;,{\&quot;to\&quot;:\&quot;#gh-launch-modal-bg\&quot;,\&quot;transition\&quot;:\[\[\&quot;transition-all\&quot;,\&quot;transform\&quot;,\&quot;ease-in\&quot;,\&quot;duration-200\&quot;],\[\&quot;opacity-100\&quot;],\[\&quot;opacity-0\&quot;]]}],\[\&quot;hide\&quot;,{\&quot;time\&quot;:200,\&quot;to\&quot;:\&quot;#gh-launch-modal-container\&quot;,\&quot;transition\&quot;:\[\[\&quot;transition-all\&quot;,\&quot;transform\&quot;,\&quot;ease-in\&quot;,\&quot;duration-200\&quot;],\[\&quot;opacity-100\&quot;,\&quot;translate-y-0\&quot;,\&quot;sm:scale-100\&quot;],\[\&quot;opacity-0\&quot;,\&quot;translate-y-4\&quot;,\&quot;sm:translate-y-0\&quot;,\&quot;sm:scale-95\&quot;]]}],\[\&quot;hide\&quot;,{\&quot;to\&quot;:\&quot;#gh-launch-modal\&quot;,\&quot;transition\&quot;:\[\[\&quot;block\&quot;],\[\&quot;block\&quot;],\[\&quot;hidden\&quot;]]}],\[\&quot;remove\_class\&quot;,{\&quot;names\&quot;:\[\&quot;overflow-hidden\&quot;],\&quot;to\&quot;:\&quot;body\&quot;}],\[\&quot;pop\_focus\&quot;,{}]]" phx-window-keydown="\[\[\&quot;hide\&quot;,{\&quot;to\&quot;:\&quot;#gh-launch-modal-bg\&quot;,\&quot;transition\&quot;:\[\[\&quot;transition-all\&quot;,\&quot;transform\&quot;,\&quot;ease-in\&quot;,\&quot;duration-200\&quot;],\[\&quot;opacity-100\&quot;],\[\&quot;opacity-0\&quot;]]}],\[\&quot;hide\&quot;,{\&quot;time\&quot;:200,\&quot;to\&quot;:\&quot;#gh-launch-modal-container\&quot;,\&quot;transition\&quot;:\[\[\&quot;transition-all\&quot;,\&quot;transform\&quot;,\&quot;ease-in\&quot;,\&quot;duration-200\&quot;],\[\&quot;opacity-100\&quot;,\&quot;translate-y-0\&quot;,\&quot;sm:scale-100\&quot;],\[\&quot;opacity-0\&quot;,\&quot;translate-y-4\&quot;,\&quot;sm:translate-y-0\&quot;,\&quot;sm:scale-95\&quot;]]}],\[\&quot;hide\&quot;,{\&quot;to\&quot;:\&quot;#gh-launch-modal\&quot;,\&quot;transition\&quot;:\[\[\&quot;block\&quot;],\[\&quot;block\&quot;],\[\&quot;hidden\&quot;]]}],\[\&quot;remove\_class\&quot;,{\&quot;names\&quot;:\[\&quot;overflow-hidden\&quot;],\&quot;to\&quot;:\&quot;body\&quot;}],\[\&quot;pop\_focus\&quot;,{}]]" phx-key="escape">

&#x20; <!-- Backdrop -->

&#x20; <div id="gh-launch-modal-bg" class="fixed inset-0 z-\[9999] bg-white/80 transition-opacity" aria-hidden="true"></div>

&#x20; 

<!-- Full-screen container -->

&#x20; <div id="gh-launch-modal-container" class="fixed inset-0 z-\[9999] overflow-y-auto">

&#x20;   <div class="flex min-h-full items-center justify-center p-0">

&#x20;     <!-- Modal content -->

&#x20;     <div id="gh-launch-modal-content" class="relative w-full h-screen bg-white shadow-xl overflow-y-auto">

&#x20;       <!-- Header -->

&#x20;       <div class="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-8 flex flex-col justify-between items-center text-center">

&#x20;         <h2 class="font-heading text-center text-2xl md:text-3xl lg:text-4xl text-navy mb-3">

&#x20;           Launch an App from GitHub

&#x20;         </h2>

&#x20;         <p class="text-gray-500">Deploy an app from an existing GitHub repository.</p>

&#x20;         <button phx-click="\[\[\&quot;hide\&quot;,{\&quot;to\&quot;:\&quot;#gh-launch-modal-bg\&quot;,\&quot;transition\&quot;:\[\[\&quot;transition-all\&quot;,\&quot;transform\&quot;,\&quot;ease-in\&quot;,\&quot;duration-200\&quot;],\[\&quot;opacity-100\&quot;],\[\&quot;opacity-0\&quot;]]}],\[\&quot;hide\&quot;,{\&quot;time\&quot;:200,\&quot;to\&quot;:\&quot;#gh-launch-modal-container\&quot;,\&quot;transition\&quot;:\[\[\&quot;transition-all\&quot;,\&quot;transform\&quot;,\&quot;ease-in\&quot;,\&quot;duration-200\&quot;],\[\&quot;opacity-100\&quot;,\&quot;translate-y-0\&quot;,\&quot;sm:scale-100\&quot;],\[\&quot;opacity-0\&quot;,\&quot;translate-y-4\&quot;,\&quot;sm:translate-y-0\&quot;,\&quot;sm:scale-95\&quot;]]}],\[\&quot;hide\&quot;,{\&quot;to\&quot;:\&quot;#gh-launch-modal\&quot;,\&quot;transition\&quot;:\[\[\&quot;block\&quot;],\[\&quot;block\&quot;],\[\&quot;hidden\&quot;]]}],\[\&quot;remove\_class\&quot;,{\&quot;names\&quot;:\[\&quot;overflow-hidden\&quot;],\&quot;to\&quot;:\&quot;body\&quot;}],\[\&quot;pop\_focus\&quot;,{}]]" type="button" class="absolute top-4 right-4 flex-none p-2 opacity-50 rounded-lg hover:bg-gray-100 hover:opacity-100 focus:outline-none transition" aria-label="close" style="z-index: 20;">

&#x20;           <span class="hero-x-mark-solid h-6 w-6"></span>

&#x20;         </button>

&#x20;       </div>

&#x20;       

<!-- Content -->

&#x20;       <div class="p-6 max-w-7xl mx-auto">

&#x20;         <!-- GitHub Integration Setup - shows when not connected or needs setup -->

&#x20;         <div class="text-center">

&#x20;           <div class="text-center space-y-6 mx-auto flex justify-center items-center flex-col py-4">

&#x20; <img src="/phx/images/dashboard/connect-to-github-c48c595fc666d71ac90b06ff2fea1a06.webp?vsn=d" alt="GitHub placeholder avatar" class="mx-auto max-w-\[600px] w-full">

&#x20; <div class="py-12 w-full max-w-2xl mx-auto">

&#x20;   <h2 class="text-2xl font-bold text-navy mb-4">

&#x20;     Let's get your GitHub account connected!

&#x20;   </h2>

&#x20;   <p class="text-gray-600 text-lg mb-7">

&#x20;     You'll be asked to authenticate and install our GitHub App. You can manage this integration or disconnect it later in your account settings.

&#x20;   </p>

&#x20;   



<button type="button" class="gap-2 btn-xl group/btn gap-2 btn-xl group/btn btn-xl btn-purple btn-border-dark" id="setup-github-integration-combined" phx-hook="GithubOAuthPopup" data-height="750" data-opts="toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no" data-width="650" data-window-name="Connect GitHub Account" data-provider="github\_app">

&#x20; 



&#x20;   

&#x20;     

<svg role="img" class="" viewBox="0 0 20 20" style="pointer-events: none; width: 20px; height: 20px; " fill="currentColor">

&#x20; <g buffered-rendering="static">

&#x20;   <path d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"></path>

&#x20; </g>

</svg> Connect GitHub account

&#x20;   

&#x20; 



&#x20; <div class="flex items-center opacity-50 group-hover/btn:opacity-100 transition-opacity ">

&#x20;   <svg role="img" viewBox="0 0 16 16" width="0" height="10" fill="currentColor" class="w-0 group-hover/btn:w-2.5 h-3 translate-x-2.5 ease-out duration-200 transition-all transform-gpu">

&#x20;     <path d="M1 9h14a1 1 0 000-2H1a1 1 0 000 2z"></path>

&#x20;   </svg>

&#x20;   <svg role="img" viewBox="0 0 16 16" width="10" height="10" fill="currentColor" class="size-\[0.7em]">

&#x20;     <path d="M7.293 1.707L13.586 8l-6.293 6.293a1 1 0 001.414 1.414l7-7a.999.999 0 000-1.414l-7-7a1 1 0 00-1.414 1.414z"></path>

&#x20;   </svg>

&#x20; </div>



</button>



&#x20;   

&#x20; </div>

</div>

&#x20;         </div>

&#x20;         

<!-- Repository Chooser - shows when connected and setup complete -->

&#x20;         

&#x20;       </div>

&#x20;     </div>

&#x20;   </div>

&#x20; </div>

</div>

</div>



<div role="alert" class="fixed bottom-6 mb-14 lg:mb-0 left-1/2 transform -translate-x-1/2 w-max max-w-\[94%] sm:max-w-lg z-\[9999]">

&#x20; 

</div><div role="alert" class="fixed bottom-6 mb-14 lg:mb-0 left-1/2 transform -translate-x-1/2 w-max max-w-\[94%] sm:max-w-lg z-\[9999]">

&#x20; 

</div><div role="alert" class="fixed bottom-6 mb-14 lg:mb-0 left-1/2 transform -translate-x-1/2 w-max max-w-\[94%] sm:max-w-lg z-\[9999]">

&#x20; 

</div><div role="alert" class="fixed bottom-6 mb-14 lg:mb-0 left-1/2 transform -translate-x-1/2 w-max max-w-\[94%] sm:max-w-lg z-\[9999]">

&#x20; 

</div><div role="alert" class="fixed bottom-6 mb-14 lg:mb-0 left-1/2 transform -translate-x-1/2 w-max max-w-\[94%] sm:max-w-lg z-\[9999]">

&#x20; 

</div></div>

&#x20;   </div>

&#x20; </body>

</html>

