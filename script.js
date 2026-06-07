const STORAGE_KEY = "caseTracker";

let cases =
JSON.parse(localStorage.getItem(STORAGE_KEY))
|| [];

let editingCaseId = null;

const subStatusMap = {

    "Need Info":[
        "Awaiting Validation",
        "Awaiting Inputs",
        "Attempted Contact",
        "In Consult"
    ],

    "Implemented":[
        "Education Only",
        "Implemented Only",
        "Troubleshooting Only"
    ],

    "Inactive":[
        "Not Interested",
        "Not Reachable",
        "Not Ready",
        "Out Of Scope"
    ],

    "Open":[]
};

const statusSelect =
document.getElementById("status");

const subStatusSelect =
document.getElementById("subStatus");

statusSelect.addEventListener("change", ()=>{

    const status = statusSelect.value;

    subStatusSelect.innerHTML =
    '<option value="">Selecione</option>';

    if(subStatusMap[status]){

        subStatusMap[status].forEach(sub=>{

            const option =
            document.createElement("option");

            option.value = sub;
            option.textContent = sub;

            subStatusSelect.appendChild(option);
        });
    }
});

function saveStorage(){
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(cases)
    );
}

function addCase(){

    const caseNumber =
    document.getElementById("caseNumber").value;

    if(!caseNumber){
        alert("Informe o número do caso");
        return;
    }

   cases.push({

    id: Date.now(),

    caseNumber,

    status:
    document.getElementById("status").value,

    subStatus:
    document.getElementById("subStatus").value,

    notes:
    document.getElementById("notes").value,

    followUpDate:
    document.getElementById("followUpDate").value,

    noteAdded:
    document.getElementById("noteAdded").checked,

    emailSent:
    document.getElementById("emailSent").checked,

    qplusDone:
    document.getElementById("qplusDone").checked,

    createdAt:
    new Date().toLocaleString(),

    updatedAt:
    new Date().toLocaleString()

});

    saveStorage();

renderCases();
updateDashboard();
updateFollowUpAlerts();
clearForm();

document.getElementById("caseNumber").value = "";

document.getElementById("status").value = "";

document.getElementById("subStatus").innerHTML =
'<option value="">Selecione Substatus</option>';

document.getElementById("notes").value = "";

document.getElementById("noteAdded").checked = false;

document.getElementById("emailSent").checked = false;

document.getElementById("qplusDone").checked = false;
}

function deleteCase(id){

    if(!confirm("Excluir caso?"))
        return;

    cases =
    cases.filter(c=>c.id !== id);

    saveStorage();

    renderCases();
    updateDashboard();
    updateFollowUpAlerts();
}

function renderCases(){

    const table =
    document.getElementById("caseTable");

    const search =
    document.getElementById("search")
    .value.toLowerCase();

    table.innerHTML = "";

    cases

    .sort((a,b)=>{

        const today =
        new Date().toISOString().split('T')[0];

        const getPriority = (item)=>{

            if(
                item.followUpDate &&
                item.followUpDate < today
            ){
                return 1; // vencido
            }

            if(
                item.followUpDate === today
            ){
                return 2; // hoje
            }

            return 3; // restante
        };

        return getPriority(a) - getPriority(b);

    })

    .filter(c =>
        c.caseNumber
        .toLowerCase()
        .includes(search)
    )

    .forEach(c=>{

        table.innerHTML += `
        <tr>

            <td>${c.caseNumber}</td>

            <td>${c.status}</td>

            <td>${c.subStatus || '-'}</td>

            <td>${c.createdAt || '-'}</td>

            <td>${c.updatedAt || '-'}</td>

            <td>${c.followUpDate || '-'}</td>

            <td>${c.noteAdded ? '✅':'❌'}</td>

            <td>${c.emailSent ? '✅':'❌'}</td>

            <td>${c.qplusDone ? '✅':'❌'}</td>

            <td>

                <button
                    class="edit-btn"
                    onclick="editCase(${c.id})">
                    Editar
                </button>

                <button
                    class="delete-btn"
                    onclick="deleteCase(${c.id})">
                    Excluir
                </button>

            </td>

        </tr>
        `;
    });
}

let chart;

function updateDashboard(){

    const total = cases.length;

    const needInfo =
    cases.filter(
        c=>c.status==="Need Info"
    ).length;

    const implemented =
    cases.filter(
        c=>c.status==="Implemented"
    ).length;

    const inactive =
    cases.filter(
        c=>c.status==="Inactive"
    ).length;

    const needInfoPct =
    total ? ((needInfo/total)*100).toFixed(1) : 0;

    const implementedPct =
    total ? ((implemented/total)*100).toFixed(1) : 0;

    const inactivePct =
    total ? ((inactive/total)*100).toFixed(1) : 0;

    document.getElementById(
        "totalCases"
    ).textContent = total;

    document.getElementById(
        "needInfoCount"
    ).innerHTML =
    `${needInfo}<br><small>${needInfoPct}%</small>`;

    document.getElementById(
        "implementedCount"
    ).innerHTML =
    `${implemented}<br><small>${implementedPct}%</small>`;

    document.getElementById(
        "inactiveCount"
    ).innerHTML =
    `${inactive}<br><small>${inactivePct}%</small>`;

    const ctx =
    document.getElementById("statusChart");

    if(chart){
        chart.destroy();
    }

    chart = new Chart(ctx,{

        type:"pie",

        data:{
            labels:[
                `Need Info (${needInfoPct}%)`,
                `Implemented (${implementedPct}%)`,
                `Inactive (${inactivePct}%)`
            ],

            datasets:[{
                data:[
                    needInfo,
                    implemented,
                    inactive
                ]
            }]
        },

        options:{
            responsive:true,
            maintainAspectRatio:false,

            plugins:{
                legend:{
                    position:'bottom'
                }
            }
        }
    });
}

function saveCase(){

    if(editingCaseId){

        updateCase();

    }else{

        addCase();

    }

}

function editCase(id){

    const caseData =
    cases.find(c => c.id === id);

    if(!caseData) return;

    editingCaseId = id;

    document.getElementById("caseNumber").value =
    caseData.caseNumber;

    document.getElementById("status").value =
    caseData.status;

    statusSelect.dispatchEvent(
        new Event('change')
    );

    document.getElementById("subStatus").value =
    caseData.subStatus;

    document.getElementById("notes").value =
    caseData.notes;

    document.getElementById("noteAdded").checked =
    caseData.noteAdded;

    document.getElementById("emailSent").checked =
    caseData.emailSent;

    document.getElementById("qplusDone").checked =
    caseData.qplusDone;

    document.getElementById("saveButton")
    .textContent =
    "Atualizar Caso";
    document.getElementById("followUpDate").value =
    caseData.followUpDate || "";
    
    window.scrollTo({
        top:0,
        behavior:"smooth"
    });

}

function updateCase(){

    const index =
    cases.findIndex(
        c => c.id === editingCaseId
    );

    if(index === -1) return;

    cases[index] = {

    ...cases[index],

    caseNumber:
    document.getElementById("caseNumber").value,

    status:
    document.getElementById("status").value,

    subStatus:
    document.getElementById("subStatus").value,

    notes:
    document.getElementById("notes").value,

    followUpDate:
    document.getElementById("followUpDate").value,

    noteAdded:
    document.getElementById("noteAdded").checked,

    emailSent:
    document.getElementById("emailSent").checked,

    qplusDone:
    document.getElementById("qplusDone").checked,

    updatedAt:
    new Date().toLocaleString()

};

    saveStorage();

    renderCases();
    updateDashboard();
    updateFollowUpAlerts();
    clearForm();

    editingCaseId = null;

    document.getElementById("saveButton")
    .textContent =
    "Salvar Caso";

}

function clearForm(){

    document.getElementById("caseNumber").value = "";

    document.getElementById("status").value = "";

    document.getElementById("subStatus").innerHTML =
    '<option value="">Selecione Substatus</option>';

    document.getElementById("notes").value = "";

    document.getElementById("noteAdded").checked = false;

    document.getElementById("emailSent").checked = false;

    document.getElementById("qplusDone").checked = false;

    document.getElementById("followUpDate").value = "";
}

function updateFollowUpAlerts(){

    const today =
    new Date().toISOString().split('T')[0];

    const overdue =
    cases.filter(c =>
        c.followUpDate &&
        c.followUpDate < today
    );

    const todayCases =
    cases.filter(c =>
        c.followUpDate === today
    );

    const div =
    document.getElementById(
        "followUpAlerts"
    );

    let html = "";

    if(overdue.length){

        html += `
        <div class="alert overdue">

            ⚠️ Follow Ups Vencidos:
            ${overdue.length}

        </div>
        `;
    }

    if(todayCases.length){

        html += `
        <div class="alert today">

            📅 Follow Ups Hoje:
            ${todayCases.length}

        </div>
        `;
    }

    div.innerHTML = html;
}

renderCases();
updateDashboard();
updateFollowUpAlerts();
