document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('style-form');
    const uploadSection = document.getElementById('upload-section');
    const processingSection = document.getElementById('processing-section');
    const resultsSection = document.getElementById('results-section');

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-upload');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image');
    const dropContent = document.getElementById('drop-content');
    const errorMsg = document.getElementById('error-msg');

    let currentFile = null;

    // --- DRAG & DROP ---
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }, false));
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.add('border-brand-500', 'bg-white/[0.03]'), false));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.remove('border-brand-500', 'bg-white/[0.03]'), false));

    dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files), false);
    fileInput.addEventListener('change', e => handleFiles(e.target.files), false);
    dropZone.addEventListener('click', e => {
        if (e.target !== fileInput && e.target.closest('#remove-image') === null) fileInput.click();
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            if (file.size / (1024 * 1024) > 10) { showError('File too large. Max 10MB.'); return; }
            const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!validTypes.includes(file.type)) { showError('Invalid file type.'); return; }
            currentFile = file;
            showPreview(file);
            hideError();
        }
    }

    function showPreview(file) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            imagePreview.src = reader.result;
            imagePreview.classList.remove('hidden');
            removeImageBtn.classList.remove('hidden');
            dropContent.classList.add('opacity-0');
        };
    }

    removeImageBtn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        currentFile = null; fileInput.value = '';
        imagePreview.src = ''; imagePreview.classList.add('hidden');
        removeImageBtn.classList.add('hidden'); dropContent.classList.remove('opacity-0');
    });

    function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.remove('hidden'); }
    function hideError() { errorMsg.classList.add('hidden'); }

    // --- FORM SUBMIT ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentFile || !document.querySelector('input[name="gender"]:checked')) {
            showError("Please upload a photo and select your identity.");
            return;
        }
        hideError();

        uploadSection.classList.add('hidden');
        processingSection.classList.remove('hidden');
        processingSection.classList.add('slide-up-fade-in');

        const texts = [
            "Analyzing facial structure and skin tone...",
            "Detecting body type and seasonal color profile...",
            "Consulting Gemini AI stylist algorithms...",
            "Building your personalized color palette...",
            "Curating outfit combinations and accessories...",
            "Generating shoppable product matches..."
        ];
        let textIdx = 0;
        const textInterval = setInterval(() => {
            textIdx = (textIdx + 1) % texts.length;
            document.getElementById('processing-text').textContent = texts[textIdx];
        }, 2200);

        try {
            const formData = new FormData();
            formData.append('image', currentFile);
            formData.append('gender', document.querySelector('input[name="gender"]:checked').value);
            
            const contextText = document.getElementById('context-input').value;
            if (contextText) {
                formData.append('context', contextText);
            }

            // Use absolute URL in production to prevent vercel routing issues
            const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                ? '/api/analyse' 
                : `${window.location.origin}/api/analyse`;

            const response = await fetch(apiUrl, { method: 'POST', body: formData });
            
            if (!response.ok) {
                let errorMessage = `Server Error: ${response.status}`;
                try {
                    // Clone the response IMMEDIATELY. .clone() is SYNCHRONOUS.
                    const clone = response.clone();
                    
                    // Try to parse as JSON first
                    try {
                        const errorData = await clone.json();
                        errorMessage = errorData.error || errorMessage;
                    } catch (jsonErr) {
                        // Fallback to text if JSON fails
                        const textError = await response.text();
                        errorMessage = textError.length > 100 ? `${errorMessage} (Check Logs)` : textError;
                    }
                } catch (err) {
                    console.error('Final fallback error parsing:', err);
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            clearInterval(textInterval);

            renderResults(data);

            processingSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');
            resultsSection.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            clearInterval(textInterval);
            uploadSection.classList.remove('hidden');
            processingSection.classList.add('hidden');
            showError(error.message);
        }
    });

    // --- RENDER RESULTS ---
    function renderResults(data) {
        // Skin tone swatch
        const [r, g, b] = data.skinTone.rgb;
        document.getElementById('skin-tone-swatch').style.backgroundColor = `rgb(${r},${g},${b})`;
        document.getElementById('skin-tone-category').textContent = data.skinTone.category;

        // Body type & seasonal tone
        document.getElementById('body-type').textContent = data.bodyType || '—';
        document.getElementById('seasonal-tone').textContent = data.seasonalTone || '—';
        document.getElementById('seasonal-label').textContent =
            `${data.seasonalTone || 'Neutral'} · ${data.bodyType || 'Average'} Build`;

        // Dress codes
        const dressList = document.getElementById('dress-codes-list');
        dressList.innerHTML = '';
        const codes = data.dressCodes || [];
        document.getElementById('dress-code-count').textContent = `${codes.length} styles`;
        codes.forEach(code => {
            const pill = document.createElement('span');
            pill.className = 'dress-code-pill';
            pill.textContent = code;
            dressList.appendChild(pill);
        });

        // Gradient Banner
        const cp = data.colorPalette || {};
        const c1 = cp.primary || '#14b8a6';
        const c2 = cp.secondary || '#7c3aed';
        const c3 = cp.accent || '#ec4899';
        document.getElementById('banner-gradient').style.background =
            `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;

        // Color Palette (5 colors)
        const paletteList = document.getElementById('color-palette-list');
        paletteList.innerHTML = '';
        const gradientBar = document.getElementById('palette-gradient-bar');
        gradientBar.innerHTML = '';

        const colors = [
            { hex: cp.primary, name: cp.primaryName || 'Primary', label: 'Primary' },
            { hex: cp.secondary, name: cp.secondaryName || 'Secondary', label: 'Secondary' },
            { hex: cp.accent, name: cp.accentName || 'Accent', label: 'Accent' },
            { hex: cp.neutral, name: cp.neutralName || 'Neutral', label: 'Neutral' },
            { hex: cp.highlight, name: cp.highlightName || 'Highlight', label: 'Highlight' }
        ];

        colors.forEach(color => {
            if (!color.hex) return;

            // Swatch row
            const row = document.createElement('div');
            row.className = 'color-swatch-row';
            row.style.setProperty('--swatch-color', color.hex);
            row.innerHTML = `
                <div class="color-swatch-circle" style="background-color: ${color.hex};"></div>
                <div class="color-swatch-info">
                    <p class="color-swatch-name">${color.name}</p>
                    <p class="color-swatch-hex">${color.hex}</p>
                </div>
                <span class="color-swatch-label">${color.label}</span>
            `;
            row.addEventListener('click', () => copyColor(color.hex));
            paletteList.appendChild(row);

            // Gradient bar segment
            const seg = document.createElement('div');
            seg.className = 'flex-1 transition-all duration-300 hover:flex-[2]';
            seg.style.backgroundColor = color.hex;
            seg.title = `${color.name} (${color.hex})`;
            gradientBar.appendChild(seg);
        });

        // Hairstyle
        if (data.hairstyle) {
            document.getElementById('hairstyle-name').textContent = data.hairstyle.name;
            document.getElementById('hairstyle-howto').textContent = data.hairstyle.howTo;
        }

        // Accessories
        const accessoriesList = document.getElementById('accessories-list');
        accessoriesList.innerHTML = '';
        if (data.accessories && data.accessories.length > 0) {
            data.accessories.forEach(acc => {
                const el = document.createElement('span');
                el.className = 'accessory-badge';
                el.textContent = acc;
                accessoriesList.appendChild(el);
            });
        }

        // Rationale
        document.getElementById('rationale-text').textContent = data.whyItWorks;

        // Outfit
        const outfitGrid = document.getElementById('outfit-grid');
        outfitGrid.innerHTML = '';
        if (data.suggestedOutfit) {
            Object.entries(data.suggestedOutfit).forEach(([key, item]) => {
                const hexColor = item.hexColor || '#14b8a6';
                const card = document.createElement('div');
                card.className = 'outfit-card';
                card.style.setProperty('--outfit-color', hexColor);
                card.innerHTML = `
                    <div class="flex items-center space-x-2 mb-2">
                        <div class="w-5 h-5 rounded-full flex-shrink-0" style="background-color: ${hexColor}; box-shadow: 0 0 8px ${hexColor}40;"></div>
                        <p class="text-[10px] text-gray-500 capitalize font-bold uppercase tracking-widest">${key}</p>
                    </div>
                    <p class="text-sm font-bold text-white">${item.color} ${item.type}</p>
                    <p class="text-[11px] text-brand-400 font-medium mt-1">${item.brand || 'Suggested Brand'}</p>
                `;
                outfitGrid.appendChild(card);
            });
        }

        // Products
        const productsGrid = document.getElementById('products-grid');
        productsGrid.innerHTML = '';
        if (data.products && data.products.length > 0) {
            data.products.forEach(prod => {
                const card = document.createElement('a');
                card.href = prod.url;
                card.target = "_blank";
                card.className = 'product-card group';
                card.innerHTML = `
                    <div class="h-24 bg-white/[0.02] flex items-center justify-center relative overflow-hidden">
                        <div class="absolute inset-0 bg-gradient-to-br from-brand-600/5 to-violet-600/5 group-hover:from-brand-600/10 group-hover:to-violet-600/10 transition-colors"></div>
                        <svg class="w-8 h-8 text-gray-700 group-hover:text-brand-400 transition-colors relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                    </div>
                    <div class="p-3 border-t border-white/5">
                        <p class="text-xs font-bold text-white mb-0.5 group-hover:text-brand-400 transition-colors truncate">${prod.name}</p>
                        <p class="text-[10px] text-gray-600 flex justify-between items-center">
                            <span>${prod.provider || 'Shop Now'}</span>
                            <svg class="w-3 h-3 text-brand-500 opacity-0 group-hover:opacity-100 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </p>
                    </div>
                `;
                productsGrid.appendChild(card);
            });
        }
    }

    // --- COPY COLOR ---
    function copyColor(hex) {
        navigator.clipboard.writeText(hex).then(() => {
            const toast = document.getElementById('copy-toast');
            toast.textContent = `${hex} copied!`;
            toast.classList.add('toast-visible');
            setTimeout(() => toast.classList.remove('toast-visible'), 1800);
        }).catch(() => {});
    }

    // --- RESET ---
    document.getElementById('reset-btn').addEventListener('click', () => {
        resultsSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        uploadSection.classList.add('slide-up-fade-in');
        removeImageBtn.click();
        form.reset();
        window.scrollTo(0, 0);
    });

});
