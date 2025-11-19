// Configuração inicial de listeners
document.addEventListener('DOMContentLoaded', (event) => {
    // Listener para mostrar arquivos selecionados na Compressão
    const compressInput = document.getElementById('compressInput');
    if (compressInput) {
        compressInput.addEventListener('change', (event) => {
            updateDropAreaText('compressPdf', event.target.files);
        });
    }
});

// Função auxiliar para atualizar texto da área de drop
function updateDropAreaText(containerId, files) {
    const dropAreaText = document.querySelector(`#${containerId} p`);
    if (!files || files.length === 0) {
        if (dropAreaText) dropAreaText.textContent = 'Arraste arquivo(s) aqui ou clique para selecionar';
        return;
    }
    const fileNames = Array.from(files).map(file => file.name).join(', ');
    if (dropAreaText) dropAreaText.textContent = 'Selecionado(s): ' + fileNames;
}

let selectedImages = [];

function mostrarFormulario(id, botaoClicado) {
    // Esconde todos
    ['imgToPdf', 'pdfToImg', 'compressPdf', 'juntarpdf', 'splitPdf', 'ocrImage'].forEach(elId => {
        document.getElementById(elId).classList.add('hidden');
    });
    document.getElementById('pdfFiles').classList.add('hidden');
    const outputCanvas = document.getElementById('outputCanvas');
    if(outputCanvas) outputCanvas.innerHTML = '';
    document.getElementById('statusMessage').classList.add('hidden');

    // Mostra o selecionado
    document.getElementById(id).classList.remove('hidden');

    // Atualiza botões
    const botoes = document.querySelectorAll('#botoesFormularios button');
    botoes.forEach(btn => btn.classList.remove('botao-ativo'));
    botaoClicado.classList.add('botao-ativo');
}

function allowDrop(e) { e.preventDefault(); }
function allowDropIPP(event) { event.preventDefault(); }

function handleFileDrop(e, inputId) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    const input = document.getElementById(inputId);
    if (input) input.files = files;

    if (inputId === 'compressInput') {
        updateDropAreaText('compressPdf', files);
    } else if (inputId === 'ocrInput') {
        previewOcrFile({ target: { files: files } });
    } else if (inputId === 'imgInputIPP') {
        previewFileIPP({ target: { files: files } }, 'imgPreviewIPP');
    } else if (inputId === 'pdfInput') {
        previewFile({ target: { files: files } }, 'pdfPreview');
    } else if (inputId === 'splitInput') {
        previewFile({ target: { files: files } }, 'splitPreview');
    }
}

function handleFileDropIPP(event, inputId) {
    event.preventDefault();
    const input = document.getElementById(inputId);
    const dt = new DataTransfer();
    Array.from(event.dataTransfer.files).forEach(file => dt.items.add(file));
    input.files = dt.files;
    previewFileIPP({ target: { files: dt.files } }, 'imgPreviewIPP');
}

function previewFile(event, previewId) {
    const files = Array.from(event.target.files);
    const preview = document.getElementById(previewId);
    preview.innerHTML = '';
    files.forEach((file, index) => {
        if (file.type === 'application/pdf') {
            const div = document.createElement('div');
            div.className = 'p-2 bg-gray-800 rounded shadow mb-2 flex justify-between items-center';
            div.innerHTML = `<span>📄 ${file.name}</span>`;
            preview.appendChild(div);
        }
    });
}

function previewFileIPP(event, previewId) {
    const files = Array.from(event.target.files);
    files.forEach(file => {
        if (file.type.startsWith('image')) {
            const url = URL.createObjectURL(file);
            selectedImages.push({ url, file });
        }
    });
    event.target.value = '';
    renderPreview(previewId);
}

function renderPreview(previewId) {
    const preview = document.getElementById(previewId);
    preview.innerHTML = '';
    selectedImages.forEach((item, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'relative border border-gray-700 rounded p-1 cursor-move inline-block m-1';

        const img = document.createElement('img');
        img.src = item.url;
        img.className = 'max-w-[150px] max-h-[150px] object-contain';

        const btn = document.createElement('button');
        btn.innerText = '✕';
        btn.className = 'absolute top-0 right-0 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md';
        btn.onclick = () => {
            URL.revokeObjectURL(item.url);
            selectedImages.splice(index, 1);
            renderPreview(previewId);
        };

        wrapper.appendChild(img);
        wrapper.appendChild(btn);
        preview.appendChild(wrapper);
    });
}

function setPreset(tipo) {
    const qual = document.getElementById('pdfImgQuality');
    const esc = document.getElementById('pdfImgScale');
    if (tipo === 'alta') { qual.value = 1.0; esc.value = 100; }
    else if (tipo === 'equilibrado') { qual.value = 0.8; esc.value = 70; }
    else if (tipo === 'compacto') { qual.value = 0.5; esc.value = 50; }
}

function setImgPreset(tipo) {
    const qual = document.getElementById('imgQuality');
    const esc = document.getElementById('imgScale');
    if (tipo === 'alta') { qual.value = 1.0; esc.value = 100; }
    else if (tipo === 'equilibrado') { qual.value = 0.8; esc.value = 70; }
    else if (tipo === 'compacto') { qual.value = 0.5; esc.value = 50; }
}

// ----------------------------------------------------------------
// FUNÇÕES DE CONVERSÃO E PROCESSAMENTO
// ----------------------------------------------------------------

async function converterImagensParaPDF() {
    if (!selectedImages.length) return alert('Selecione uma ou mais imagens');
    const files = selectedImages.map(item => item.file);
    const nome = document.getElementById('pdfName').value.trim() || 'imagens_convertidas';
    const quality = parseFloat(document.getElementById('imgQuality').value);
    const scale = parseInt(document.getElementById('imgScale').value) / 100;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const pica = window.pica();
    let primeira = true;

    for (const file of files) {
        const imgData = await fileToImageData(file, pica, quality, scale);
        const img = new Image();
        await new Promise(res => { img.onload = res; img.src = imgData; });

        const width = pdf.internal.pageSize.getWidth();
        const height = (img.height * width) / img.width;
        if (!primeira) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
        primeira = false;
    }
    pdf.save(`${nome}.pdf`);
}

// --- FUNÇÃO COMPRIMIR PDF SIMPLIFICADA (Sem barras) ---
async function comprimirPDF() {
    const input = document.getElementById('compressInput');
    const files = input.files;
    
    // DEFINIÇÕES PADRÃO (Automático)
    const quality = 0.5; // Qualidade média/boa
    const scale = 1.0;   // Mantém tamanho original (não aumenta)

    if (!files || files.length === 0) return alert('Selecione um ou mais PDFs para comprimir.');

    const button = document.getElementById('btnCompress');
    const originalText = button.textContent;
    const statusDiv = document.getElementById('statusMessage');

    button.innerHTML = '<div class="loader"></div> Processando...';
    button.disabled = true;
    statusDiv.classList.remove('hidden');
    statusDiv.textContent = "Iniciando compressão...";

    try {
        const { jsPDF } = window.jspdf;
        const zip = new JSZip();
        let singlePDFBlob = null;
        let singleFileName = "";

        for (let f = 0; f < files.length; f++) {
            const file = files[f];
            statusDiv.textContent = `Comprimindo arquivo ${f + 1} de ${files.length}: ${file.name}`;

            const arrayBuffer = await file.arrayBuffer();
            const typedarray = new Uint8Array(arrayBuffer);
            const pdfDoc = await pdfjsLib.getDocument(typedarray).promise;

            const novoPDF = new jsPDF();
            let firstPage = true;

            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: scale });

                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({
                    canvasContext: canvas.getContext('2d'),
                    viewport
                }).promise;

                const imgData = canvas.toDataURL('image/jpeg', quality);

                const pdfWidth = novoPDF.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                if (!firstPage) novoPDF.addPage();
                firstPage = false;
                novoPDF.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }

            const originalName = file.name.replace('.pdf', '');
            const outputName = `${originalName}_comprimido.pdf`;

            if (files.length === 1) {
                singlePDFBlob = novoPDF.output('blob');
                singleFileName = outputName;
            } else {
                zip.file(outputName, novoPDF.output('blob'));
            }
        }

        statusDiv.textContent = "Finalizando e baixando...";

        if (files.length === 1) {
            saveAs(singlePDFBlob, singleFileName);
        } else {
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, "arquivos_comprimidos.zip");
        }

    } catch (error) {
        console.error(error);
        alert("Erro na compressão: " + error.message);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
        statusDiv.classList.add('hidden');
        input.value = null;
        updateDropAreaText('compressPdf', null);
    }
}

// Outras funções
let pdfFiles = [];
function handleFiles(files) {
    for (const file of files) {
        if (file.type === 'application/pdf') {
            pdfFiles.push(file);
        }
    }
    renderFileList();
}

function renderFileList() {
    const list = document.getElementById('fileList');
    list.innerHTML = '';
    pdfFiles.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = "flex justify-between items-center bg-gray-800 p-2 rounded";
        li.innerHTML = `
          <span class="truncate w-2/3">${index + 1}. ${file.name}</span>
          <div class="flex gap-2">
            <button class="text-blue-400 hover:text-blue-300" onclick="moveUp(${index})">🔼</button>
            <button class="text-blue-400 hover:text-blue-300" onclick="moveDown(${index})">🔽</button>
            <button class="text-red-500 hover:text-red-400" onclick="removeFile(${index})">❌</button>
          </div>
        `;
        list.appendChild(li);
    });
}

function moveUp(index) {
    if (index > 0) {
        [pdfFiles[index - 1], pdfFiles[index]] = [pdfFiles[index], pdfFiles[index - 1]];
        renderFileList();
    }
}

function moveDown(index) {
    if (index < pdfFiles.length - 1) {
        [pdfFiles[index], pdfFiles[index + 1]] = [pdfFiles[index + 1], pdfFiles[index]];
        renderFileList();
    }
}

function removeFile(index) {
    pdfFiles.splice(index, 1);
    renderFileList();
}

async function mergePDFs() {
    if (pdfFiles.length < 2) return alert('Selecione ao menos dois arquivos PDF para juntar.');

    const nomeArquivo = document.getElementById('fileNameInput').value.trim();
    const nomeFinal = nomeArquivo ? `${nomeArquivo}.pdf` : 'pdf-juntado.pdf';

    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();

    for (const file of pdfFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
    saveAs(blob, nomeFinal);
}

async function dividirPDF() {
    const input = document.getElementById('splitInput');
    const file = input.files[0];
    const baseName = document.getElementById('splitBaseName').value.trim() || 'paginas';
    const paginasInput = document.getElementById('splitPages').value.trim();

    if (!file) return alert('Selecione um PDF');

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    const totalPaginas = pdfDoc.getPageCount();
    const paginasSelecionadas = parsePaginas(paginasInput, totalPaginas);

    if (paginasSelecionadas.length === 0) return alert('Nenhuma página válida foi informada.');

    const novoPdf = await PDFLib.PDFDocument.create();

    for (const pagina of paginasSelecionadas) {
        const [paginaCopiada] = await novoPdf.copyPages(pdfDoc, [pagina - 1]);
        novoPdf.addPage(paginaCopiada);
    }

    const pdfBytes = await novoPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    saveAs(blob, `${baseName}_selecionadas.pdf`);
}

function fileToImageData(file, pica, quality, scale) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = async function (e) {
            const img = new Image();
            img.onload = async function () {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);

                const compCanvas = document.createElement('canvas');
                compCanvas.width = img.width * scale;
                compCanvas.height = img.height * scale;
                await pica.resize(canvas, compCanvas);
                resolve(compCanvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function parsePaginas(input, totalPaginas) {
    const numeros = new Set();
    const partes = input.split(',');

    for (const parte of partes) {
        if (parte.includes('-')) {
            const [inicio, fim] = parte.split('-').map(n => parseInt(n.trim()));
            if (!isNaN(inicio) && !isNaN(fim)) {
                for (let i = inicio; i <= fim; i++) {
                    if (i >= 1 && i <= totalPaginas) numeros.add(i);
                }
            }
        } else {
            const n = parseInt(parte.trim());
            if (!isNaN(n) && n >= 1 && n <= totalPaginas) numeros.add(n);
        }
    }
    return [...numeros].sort((a, b) => a - b);
}

async function converterPDFparaImagem() {
    const input = document.getElementById('pdfInput');
    const file = input.files[0];
    const baseName = document.getElementById('imgZipName').value.trim() || 'pagina';
    const quality = parseFloat(document.getElementById('pdfImgQuality').value);
    const scale = parseInt(document.getElementById('pdfImgScale').value) / 100;
    if (!file) return alert('Selecione um PDF');

    const reader = new FileReader();
    reader.onload = async function () {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const output = document.getElementById('outputCanvas');
        output.innerHTML = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 * scale });
            const canvas = document.createElement('canvas');
            canvas.className = 'shadow-lg rounded';
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

            output.appendChild(canvas);

            const btn = document.createElement('button');
            btn.className = 'mt-2 bg-green-600 hover:bg-green-500 text-white px-4 py-1 rounded';
            btn.textContent = `Baixar Página ${i}`;
            btn.onclick = () => {
                canvas.toBlob(blob => saveAs(blob, `${baseName}_${i}.jpg`), 'image/jpeg', quality);
            };
            output.appendChild(btn);
        }
    };
    reader.readAsArrayBuffer(file);
}

let ocrFile = null;
function previewOcrFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    ocrFile = file;
    const preview = document.getElementById('ocrPreview');
    preview.innerHTML = '';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.className = 'max-w-full max-h-64 mx-auto rounded shadow';
    preview.appendChild(img);
}

async function extrairTextoImagem() {
    if (!ocrFile) return alert('Selecione uma imagem primeiro.');
    const resultArea = document.getElementById('ocrResult');
    resultArea.value = 'Processando... aguarde...';
    const worker = await Tesseract.createWorker('por');
    const { data } = await worker.recognize(ocrFile);
    resultArea.value = data.text.trim();
    await worker.terminate();
}

function baixarTodasImagens() {
    const zip = new JSZip();
    const baseName = document.getElementById('imgZipName').value.trim() || 'pagina';
    const canvases = document.querySelectorAll('#outputCanvas canvas');
    let count = 0;
    canvases.forEach((canvas, i) => {
        canvas.toBlob(blob => {
            zip.file(`${baseName}_${i + 1}.jpg`, blob);
            count++;
            if (count === canvases.length) {
                zip.generateAsync({ type: 'blob' }).then(content => {
                    saveAs(content, `${baseName}_imagens.zip`);
                });
            }
        }, 'image/jpeg');
    });
}