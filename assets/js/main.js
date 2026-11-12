/* konti pastry — интерактив: шапка, мобильное меню, анимации появления, каталог */
(() => {
  const doc = document.documentElement;
  doc.classList.add("js");

  /* ---------- header: фон при прокрутке, скрытие при скролле вниз ---------- */
  const header = document.querySelector("[data-header]");
  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    if (!header) return;
    header.classList.toggle("is-scrolled", y > 24);
    const menuOpen = document.body.classList.contains("menu-open");
    header.classList.toggle("is-hidden", !menuOpen && y > 400 && y > lastY + 4);
    if (y < lastY - 4 || y < 400) header.classList.remove("is-hidden");
    lastY = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- мобильное меню ---------- */
  const burger = document.querySelector("[data-burger]");
  const menu = document.querySelector("[data-mmenu]");
  const setMenu = (open) => {
    if (!burger || !menu) return;
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    document.body.classList.toggle("menu-open", open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add("is-open"));
    } else {
      menu.classList.remove("is-open");
      setTimeout(() => { if (!menu.classList.contains("is-open")) menu.hidden = true; }, 400);
    }
  };
  burger?.addEventListener("click", () => setMenu(burger.getAttribute("aria-expanded") !== "true"));
  menu?.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

  /* ---------- появление элементов ---------- */
  const reveal = (root = document) => {
    const els = root.querySelectorAll(".reveal:not(.is-in)");
    if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((el) => {
      // то, что уже видно на первом экране, показываем сразу — не дожидаясь observer
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) setTimeout(() => el.classList.add("is-in"), 40);
      else io.observe(el);
    });
  };
  reveal();

  /* ---------- филиалы: переключение карты ---------- */
  const branchList = document.querySelector("[data-branches]");
  const mapFrame = document.querySelector("[data-map-frame]");
  if (branchList && mapFrame) {
    branchList.addEventListener("click", (e) => {
      const b = e.target.closest("[data-map]");
      if (!b) return;
      branchList.querySelectorAll(".branch").forEach((li) => {
        const on = li.contains(b);
        li.classList.toggle("is-active", on);
        li.querySelector("[data-map]").setAttribute("aria-pressed", String(on));
      });
      if (mapFrame.src !== b.dataset.map) mapFrame.src = b.dataset.map;
      if (window.matchMedia("(max-width: 900px)").matches) mapFrame.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  /* ---------- каталог: фильтр ---------- */
  const tabs = document.querySelector("[data-tabs]");
  const grid = document.querySelector("[data-products]");
  if (tabs && grid) {
    const cards = [...grid.querySelectorAll(".product")];
    const valid = new Set([...tabs.querySelectorAll("[data-filter]")].map((b) => b.dataset.filter));
    const apply = (cat, push = true) => {
      if (!valid.has(cat)) cat = "all";
      tabs.querySelectorAll("[data-filter]").forEach((b) => {
        const on = b.dataset.filter === cat;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      grid.querySelectorAll("[data-group]").forEach((g) => { g.hidden = !(cat === "all" || g.dataset.group === cat); });
      let i = 0;
      cards.forEach((c) => {
        const show = cat === "all" || c.dataset.cat === cat;
        c.classList.toggle("is-hidden", !show);
        c.classList.remove("is-entering");
        if (show) {
          c.classList.add("is-in");
          c.style.setProperty("--d", `${(i++ % 3) * 70}ms`);
          void c.offsetWidth;
          c.classList.add("is-entering");
        }
      });
      if (push) {
        const url = new URL(location.href);
        cat === "all" ? url.searchParams.delete("cat") : url.searchParams.set("cat", cat);
        url.hash = "";
        history.replaceState(null, "", url);
      }
    };
    tabs.addEventListener("click", (e) => {
      const b = e.target.closest("[data-filter]");
      if (!b) return;
      apply(b.dataset.filter);
      const top = tabs.getBoundingClientRect().top + window.scrollY - 80;
      if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
    });
    const initial = new URLSearchParams(location.search).get("cat");
    if (initial) apply(initial, false);
  }

  /* ---------- каталог: карточка изделия и заявка ---------- */
  const dataEl = document.getElementById("catalog-data");
  if (dataEl) {
    const payload = JSON.parse(dataEl.textContent);
    const items = payload.items;
    const lockScroll = (on) => document.body.classList.toggle("modal-open", on);
    const showDialog = (d) => { if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); lockScroll(true); };
    const hideDialog = (d) => { if (d.open && typeof d.close === "function") d.close(); else d.removeAttribute("open"); };
    const photo = (it, small) => `assets/img/photos/${it.img}${small ? "-sm" : ""}.${it.ext}?v=${it.v}`;

    /* --- карточка изделия --- */
    const modal = document.querySelector("[data-modal]");
    const $m = (s) => modal.querySelector(s);
    let current = null;
    let lastFocus = null;

    const openItem = (id, updateHash = true) => {
      const it = items[id];
      if (!it || !modal) return;
      current = id;
      lastFocus = document.activeElement;
      const img = $m("[data-m-img]");
      img.src = photo(it);
      img.alt = it.name;
      $m("[data-m-cat]").textContent = it.cat;
      $m("[data-m-name]").textContent = it.name;
      $m("[data-m-weight]").textContent = it.weight;
      $m("[data-m-details]").textContent = it.details;
      $m("[data-m-price]").innerHTML = it.price;
      const tg = $m("[data-m-wa]");
      tg.href = it.wa;
      tg.dataset.order = id;
      showDialog(modal);
      if (updateHash) history.replaceState(null, "", `${location.pathname}${location.search}#${id}`);
    };
    modal?.addEventListener("close", () => {
      if (!order?.open) lockScroll(false);
      history.replaceState(null, "", location.pathname + location.search);
      if (!order?.open) lastFocus?.focus?.({ preventScroll: true });
    });
    modal?.addEventListener("click", (e) => {
      if (e.target === modal || e.target.closest("[data-close]")) hideDialog(modal);
    });

    /* --- заявка --- */
    const order = document.querySelector("[data-order-modal]");
    const $o = (s) => order.querySelector(s);
    const fields = order ? [...order.querySelectorAll("[data-o-field]")] : [];
    const val = (k) => (fields.find((f) => f.dataset.oField === k)?.value || "").trim();
    let orderItem = null;
    let picked = []; // выбранные варианты (вес, сет или вкусы)
    const sizesBox = order?.querySelector("[data-o-sizes]");
    const sizesList = order?.querySelector("[data-o-sizes-list]");

    if (order) {
      const sel = $o('[data-o-field="filling"]');
      payload.fillings.forEach((f) => sel.add(new Option(f, f)));
      const dateInput = $o('[data-o-field="date"]');
      const min = new Date(); min.setDate(min.getDate() + 1);
      dateInput.min = min.toISOString().slice(0, 10);
    }

    const fmtDate = (v) => {
      if (!v) return "";
      const [y, m, d] = v.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    };

    const buildText = () => {
      const it = orderItem;
      const lines = [
        payload.intro,
        "",
        `Изделие: ${it.name}`,
        `Категория: ${it.cat}`,
        `Формат: ${it.weight}`,
        ...(it.options && picked.length ? [`${it.options.msg}: ${picked.map((c) => c.value).join(", ")}`] : []),
        ...(it.simple ? [] : [`Начинка: ${val("filling") || "посоветуйте, пожалуйста"}`]),
        `Дата: ${fmtDate(val("date")) || "уточню в переписке"}`,
      ];
      if (!it.simple && val("text")) lines.push(`Надпись: «${val("text")}»`);
      if (val("comment")) lines.push(`Пожелания: ${val("comment")}`);
      const ref = payload.site ? `${payload.site.replace(/\/$/, "")}/catalog.html#${current || ""}` : "";
      if (ref) lines.push(`Ссылка: ${ref}`);
      return lines.join("\n");
    };

    const render = () => {
      if (!orderItem) return;
      const text = buildText();
      $o("[data-o-preview]").textContent = text;
      $o("[data-o-send]").href = `${payload.wa}?text=${encodeURIComponent(text)}`;
    };

    const openOrder = (id) => {
      const it = items[id];
      if (!it || !order) return false;
      orderItem = it;
      current = id;
      if (!modal?.open) lastFocus = document.activeElement;
      fields.forEach((f) => { f.value = ""; });
      picked = [];
      sizesList.innerHTML = "";
      const opt = it.options;
      sizesBox.hidden = !opt;
      order.querySelectorAll("[data-o-cake-only]").forEach((el) => { el.hidden = !!it.simple; });
      if (opt) {
        sizesBox.querySelector(".field__label").textContent = opt.title;
        sizesList.setAttribute("role", opt.multi ? "group" : "radiogroup");
        opt.choices.forEach((c) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "sizes-pick__opt";
          b.setAttribute("role", opt.multi ? "checkbox" : "radio");
          b.setAttribute("aria-checked", "false");
          b.innerHTML = `<span class="sizes-pick__kg"></span><span class="sizes-pick__price"></span>`;
          b.querySelector(".sizes-pick__kg").textContent = c.label;
          b.querySelector(".sizes-pick__price").textContent = c.available ? c.price : "нет в наличии";
          if (!c.available) { b.disabled = true; b.classList.add("is-off"); }
          b.addEventListener("click", () => {
            const on = picked.includes(c);
            if (opt.multi) picked = on ? picked.filter((x) => x !== c) : [...picked, c];
            else picked = on ? [] : [c];
            sizesList.querySelectorAll(".sizes-pick__opt").forEach((o, m) => o.setAttribute("aria-checked", String(picked.includes(opt.choices[m]))));
            render();
          });
          sizesList.appendChild(b);
        });
      }
      const img = $o("[data-o-img]");
      img.src = photo(it, true);
      img.alt = it.name;
      $o("[data-o-name]").textContent = it.name;
      $o("[data-o-price]").innerHTML = it.price;
      $o("[data-o-copy-label]").textContent = "Скопировать заявку";
      render();
      if (modal?.open) hideDialog(modal);
      showDialog(order);
      $o(".order__scroll").scrollTop = 0;
      return true;
    };

    order?.addEventListener("input", render);
    order?.addEventListener("change", render);
    order?.addEventListener("close", () => { lockScroll(false); lastFocus?.focus?.({ preventScroll: true }); });
    order?.addEventListener("click", (e) => {
      if (e.target === order || e.target.closest("[data-order-close]")) hideDialog(order);
    });

    const copy = async (text) => {
      try { await navigator.clipboard.writeText(text); return true; } catch (_) {
        const ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0";
        order.appendChild(ta); ta.select();
        let ok = false; try { ok = document.execCommand("copy"); } catch (_) {}
        ta.remove(); return ok;
      }
    };
    order?.querySelector("[data-o-copy]").addEventListener("click", async () => {
      const ok = await copy(buildText());
      const label = $o("[data-o-copy-label]");
      label.textContent = ok ? "Скопировано ✓" : "Не удалось скопировать";
      setTimeout(() => { label.textContent = "Скопировать заявку"; }, 2200);
    });
    // при отправке тоже копируем — на случай, если клиент WhatsApp не подставит текст
    order?.querySelector("[data-o-send]").addEventListener("click", () => { copy(buildText()); });

    /* --- делегирование кликов --- */
    document.addEventListener("click", (e) => {
      const o = e.target.closest("[data-order]");
      if (o && items[o.dataset.order]) {
        e.preventDefault();
        openOrder(o.dataset.order);
        return;
      }
      const t = e.target.closest("[data-open]");
      if (t) { e.preventDefault(); openItem(t.dataset.open); }
    });

    const fromHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (items[id]) {
        document.getElementById(id)?.scrollIntoView({ block: "center" });
        openItem(id, false);
      }
    };
    window.addEventListener("hashchange", fromHash);
    fromHash();
  }
})();
