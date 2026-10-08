// Սկզբնական տվյալներ (օգտագործվում են միայն առաջին բացման ժամանակ, երբ բրաուզերում տվյալներ չկան)
window.SEED_EVENTS = [
  {
    "id": "ev1",
    "name": "Chronic Disease Diagnosis and Management: Multidisciplinary Dialogue",
    "start": "2026-06-06",
    "end": "",
    "regDate": "2026-06-06",
    "time": "",
    "org": "Prom-Test",
    "format": "Հովանավոր",
    "location": "Red Bridge Hotel",
    "responsible": "Դիանա Բ.",
    "audience": "Family doctors, therapists, rheumatologists, gastroenterologists, endocrinologists, cardiologists",
    "materials": "Roll-up",
    "notes": ""
  },
  {
    "id": "ev2",
    "name": "Armenian Fertility Preservation Association First Scientific Conference",
    "start": "2026-06-20",
    "end": "",
    "regDate": "2026-06-20",
    "time": "",
    "org": "Prom-Test",
    "format": "Հովանավոր",
    "location": "Radisson Blu Hotel",
    "responsible": "Դիանա Բ.",
    "audience": "Gynecologists, reproductive specialists",
    "materials": "Roll-up",
    "notes": ""
  },
  {
    "id": "ev3",
    "name": "Hello Mom",
    "start": "2026-07-11",
    "end": "",
    "regDate": "2026-06-25",
    "time": "",
    "org": "Prom-Test",
    "format": "Հովանավոր",
    "location": "Ibis Hotel",
    "responsible": "Դիանա Բ.",
    "audience": "Pregnant women",
    "materials": "Roll-up",
    "notes": ""
  },
  {
    "id": "ev4",
    "name": "Clinical Applications of Gynecological Ultrasound",
    "start": "2026-09-12",
    "end": "2026-09-13",
    "regDate": "2026-08-21",
    "time": "",
    "org": "Prom-Test",
    "format": "Հովանավոր",
    "location": "Courtyard Marriott",
    "responsible": "Դիանա Բ.",
    "audience": "Gynecologists, reproductive specialists",
    "materials": "Roll-up",
    "notes": ""
  },
  {
    "id": "ev5",
    "name": "Allergology Association Conference",
    "start": "2026-09-26",
    "end": "",
    "regDate": "2026-08-21",
    "time": "",
    "org": "Prom-Test",
    "format": "Հովանավոր",
    "location": "Armenia Marriott",
    "responsible": "Դիանա Բ.",
    "audience": "Allergists",
    "materials": "Roll-up",
    "notes": ""
  },
  {
    "id": "ev6",
    "name": "Oncology Conference \"Oncosupport 2026\"",
    "start": "2026-10-10",
    "end": "",
    "regDate": "2026-09-14",
    "time": "",
    "org": "Prom-Test",
    "format": "Հովանավոր",
    "location": "Red Bridge Hotel",
    "responsible": "Դիանա Բ.",
    "audience": "",
    "materials": "",
    "notes": ""
  }
];

// Ընտրության ցուցակներ։ Նոր անուն ավելացնելու համար գրեք այստեղ, պահպանեք և թարմացրեք էջը (Ctrl+F5)։
// Կարելի է նաև ավելացնել էջի «Ցուցակներ» կոճակով։
window.SEED_LISTS = {
  formats: [
    "Գլխավոր հովանավոր",
    "Հովանավոր",
    "Մասնակից",
    "Գործընկեր",
    "Բանախոս"
  ],
  orgs: [
    "Prom-Test",
    "Diagnostica",
    "PetCT",
    "Proftest",
    "Cell Therapy Center"
  ],
  people: [
    "Աննա Ա.",
    "Աննա Շ.",
    "Ասյա Ս.",
    "Դիանա Բ.",
    "Արմինե",
    "Լուսինե",
    "Անահիտ",
    "Սիրուշ",
    "Վարդան"
  ],
  materials: [
    "Roll-up",
    "Բուկլետ",
    "Թռուցիկ",
    "Պաստառ",
    "Գնացուցակ"
  ]
};

// Կազմակերպությունների լոգոներ գլխավոր էջի համար։
// Լոգոյի ֆայլը դրեք logos թղթապանակում՝ այստեղ նշված անունով։ Եթե ֆայլը չկա, ցույց է տրվում անունը։
window.ORG_LOGOS = {
  "Prom-Test": "logo.png",
  "Diagnostica": "logos/diagnostica.png",
  "PetCT": "logos/petct.png",
  "Proftest": "logos/proftest.png",
  "Cell Therapy Center": "logos/celltherapy.png"
};

// Տպագրական նյութերի պատվերներ։ «Պատվերներ» կոճակը բացում է այս հղումը (Google Sheet կամ Google Form)։
window.ORDER_FORM_URL = "https://docs.google.com/spreadsheets/d/1cWVqXK8i0BQi7D9KnIKKd3yPECsNt6iEW99OAqNVrzQ/edit?gid=0";

window.setupOrderLinks = function(){
  var url=String(window.ORDER_FORM_URL||"").trim();
  document.querySelectorAll(".order-link").forEach(function(a){
    if(url){a.href=url;return}
    a.removeAttribute("target");
    a.addEventListener("click",function(e){e.preventDefault();
      var n=document.getElementById("orderNote"); if(n){n.hidden=false;return}
      if(window.toast)toast("Պատվերների ձևի հղումը դեռ ավելացված չէ (data.js → ORDER_FORM_URL)։");});
  });
};
