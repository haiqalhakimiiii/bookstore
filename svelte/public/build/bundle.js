
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function get_binding_group_value(group, __value, checked) {
        const value = new Set();
        for (let i = 0; i < group.length; i += 1) {
            if (group[i].checked)
                value.add(group[i].__value);
        }
        if (!checked) {
            value.delete(__value);
        }
        return Array.from(value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.50.1' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\components\AddBook.svelte generated by Svelte v3.50.1 */

    const file$6 = "src\\components\\AddBook.svelte";

    function create_fragment$6(ctx) {
    	let div;
    	let form;
    	let input0;
    	let t0;
    	let input1;
    	let t1;
    	let input2;
    	let t2;
    	let label;
    	let t3;
    	let br0;
    	let t4;
    	let input3;
    	let t5;
    	let br1;
    	let t6;
    	let input4;
    	let t7;
    	let br2;
    	let t8;
    	let input5;
    	let t9;
    	let br3;
    	let t10;
    	let input6;
    	let t11;
    	let br4;
    	let t12;
    	let input7;
    	let t13;
    	let br5;
    	let t14;
    	let input8;
    	let t15;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			form = element("form");
    			input0 = element("input");
    			t0 = space();
    			input1 = element("input");
    			t1 = space();
    			input2 = element("input");
    			t2 = space();
    			label = element("label");
    			t3 = text("Genres: ");
    			br0 = element("br");
    			t4 = space();
    			input3 = element("input");
    			t5 = text("Action");
    			br1 = element("br");
    			t6 = space();
    			input4 = element("input");
    			t7 = text("Crime");
    			br2 = element("br");
    			t8 = space();
    			input5 = element("input");
    			t9 = text("Drama");
    			br3 = element("br");
    			t10 = space();
    			input6 = element("input");
    			t11 = text("Horror");
    			br4 = element("br");
    			t12 = space();
    			input7 = element("input");
    			t13 = text("Thriller");
    			br5 = element("br");
    			t14 = space();
    			input8 = element("input");
    			t15 = space();
    			button = element("button");
    			button.textContent = "Add Book";
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "Title");
    			add_location(input0, file$6, 32, 6, 629);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "placeholder", "Author");
    			add_location(input1, file$6, 33, 6, 700);
    			attr_dev(input2, "type", "number");
    			attr_dev(input2, "placeholder", "Number of pages");
    			add_location(input2, file$6, 34, 6, 773);
    			add_location(br0, file$6, 36, 17, 882);
    			attr_dev(input3, "type", "checkbox");
    			input3.__value = "Action";
    			input3.value = input3.__value;
    			/*$$binding_groups*/ ctx[6][0].push(input3);
    			add_location(input3, file$6, 37, 9, 897);
    			add_location(br1, file$6, 37, 78, 966);
    			attr_dev(input4, "type", "checkbox");
    			input4.__value = "Crime";
    			input4.value = input4.__value;
    			/*$$binding_groups*/ ctx[6][0].push(input4);
    			add_location(input4, file$6, 38, 9, 981);
    			add_location(br2, file$6, 38, 76, 1048);
    			attr_dev(input5, "type", "checkbox");
    			input5.__value = "Drama";
    			input5.value = input5.__value;
    			/*$$binding_groups*/ ctx[6][0].push(input5);
    			add_location(input5, file$6, 39, 9, 1063);
    			add_location(br3, file$6, 39, 76, 1130);
    			attr_dev(input6, "type", "checkbox");
    			input6.__value = "Horror";
    			input6.value = input6.__value;
    			/*$$binding_groups*/ ctx[6][0].push(input6);
    			add_location(input6, file$6, 40, 9, 1145);
    			add_location(br4, file$6, 40, 78, 1214);
    			attr_dev(input7, "type", "checkbox");
    			input7.__value = "Thriller";
    			input7.value = input7.__value;
    			/*$$binding_groups*/ ctx[6][0].push(input7);
    			add_location(input7, file$6, 41, 9, 1229);
    			add_location(br5, file$6, 41, 82, 1302);
    			add_location(label, file$6, 35, 6, 856);
    			attr_dev(input8, "type", "number");
    			attr_dev(input8, "placeholder", "Rating");
    			add_location(input8, file$6, 43, 6, 1330);
    			attr_dev(button, "type", "button");
    			add_location(button, file$6, 44, 6, 1405);
    			add_location(form, file$6, 31, 3, 615);
    			attr_dev(div, "class", "form");
    			add_location(div, file$6, 30, 0, 592);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, form);
    			append_dev(form, input0);
    			set_input_value(input0, /*book*/ ctx[0].title);
    			append_dev(form, t0);
    			append_dev(form, input1);
    			set_input_value(input1, /*book*/ ctx[0].author);
    			append_dev(form, t1);
    			append_dev(form, input2);
    			set_input_value(input2, /*book*/ ctx[0].pages);
    			append_dev(form, t2);
    			append_dev(form, label);
    			append_dev(label, t3);
    			append_dev(label, br0);
    			append_dev(label, t4);
    			append_dev(label, input3);
    			input3.checked = ~/*book*/ ctx[0].genres.indexOf(input3.__value);
    			append_dev(label, t5);
    			append_dev(label, br1);
    			append_dev(label, t6);
    			append_dev(label, input4);
    			input4.checked = ~/*book*/ ctx[0].genres.indexOf(input4.__value);
    			append_dev(label, t7);
    			append_dev(label, br2);
    			append_dev(label, t8);
    			append_dev(label, input5);
    			input5.checked = ~/*book*/ ctx[0].genres.indexOf(input5.__value);
    			append_dev(label, t9);
    			append_dev(label, br3);
    			append_dev(label, t10);
    			append_dev(label, input6);
    			input6.checked = ~/*book*/ ctx[0].genres.indexOf(input6.__value);
    			append_dev(label, t11);
    			append_dev(label, br4);
    			append_dev(label, t12);
    			append_dev(label, input7);
    			input7.checked = ~/*book*/ ctx[0].genres.indexOf(input7.__value);
    			append_dev(label, t13);
    			append_dev(label, br5);
    			append_dev(form, t14);
    			append_dev(form, input8);
    			set_input_value(input8, /*book*/ ctx[0].rating);
    			append_dev(form, t15);
    			append_dev(form, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[2]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[3]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[4]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[5]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[7]),
    					listen_dev(input5, "change", /*input5_change_handler*/ ctx[8]),
    					listen_dev(input6, "change", /*input6_change_handler*/ ctx[9]),
    					listen_dev(input7, "change", /*input7_change_handler*/ ctx[10]),
    					listen_dev(input8, "input", /*input8_input_handler*/ ctx[11]),
    					listen_dev(button, "click", prevent_default(/*doPost*/ ctx[1]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*book*/ 1 && input0.value !== /*book*/ ctx[0].title) {
    				set_input_value(input0, /*book*/ ctx[0].title);
    			}

    			if (dirty & /*book*/ 1 && input1.value !== /*book*/ ctx[0].author) {
    				set_input_value(input1, /*book*/ ctx[0].author);
    			}

    			if (dirty & /*book*/ 1 && to_number(input2.value) !== /*book*/ ctx[0].pages) {
    				set_input_value(input2, /*book*/ ctx[0].pages);
    			}

    			if (dirty & /*book*/ 1) {
    				input3.checked = ~/*book*/ ctx[0].genres.indexOf(input3.__value);
    			}

    			if (dirty & /*book*/ 1) {
    				input4.checked = ~/*book*/ ctx[0].genres.indexOf(input4.__value);
    			}

    			if (dirty & /*book*/ 1) {
    				input5.checked = ~/*book*/ ctx[0].genres.indexOf(input5.__value);
    			}

    			if (dirty & /*book*/ 1) {
    				input6.checked = ~/*book*/ ctx[0].genres.indexOf(input6.__value);
    			}

    			if (dirty & /*book*/ 1) {
    				input7.checked = ~/*book*/ ctx[0].genres.indexOf(input7.__value);
    			}

    			if (dirty & /*book*/ 1 && to_number(input8.value) !== /*book*/ ctx[0].rating) {
    				set_input_value(input8, /*book*/ ctx[0].rating);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*$$binding_groups*/ ctx[6][0].splice(/*$$binding_groups*/ ctx[6][0].indexOf(input3), 1);
    			/*$$binding_groups*/ ctx[6][0].splice(/*$$binding_groups*/ ctx[6][0].indexOf(input4), 1);
    			/*$$binding_groups*/ ctx[6][0].splice(/*$$binding_groups*/ ctx[6][0].indexOf(input5), 1);
    			/*$$binding_groups*/ ctx[6][0].splice(/*$$binding_groups*/ ctx[6][0].indexOf(input6), 1);
    			/*$$binding_groups*/ ctx[6][0].splice(/*$$binding_groups*/ ctx[6][0].indexOf(input7), 1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('AddBook', slots, []);

    	let book = {
    		title: '',
    		author: '',
    		pages: '',
    		genres: [],
    		rating: ''
    	};

    	let result = '';

    	async function doPost() {
    		const res = await fetch('http://localhost:3000/books', {
    			method: 'POST',
    			headers: { 'Content-Type': 'application/json' },
    			body: JSON.stringify(book)
    		});

    		const response = await res.json();
    		result = JSON.stringify(response);

    		$$invalidate(0, book = {
    			title: '',
    			author: '',
    			pages: '',
    			genres: [],
    			rating: ''
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<AddBook> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function input0_input_handler() {
    		book.title = this.value;
    		$$invalidate(0, book);
    	}

    	function input1_input_handler() {
    		book.author = this.value;
    		$$invalidate(0, book);
    	}

    	function input2_input_handler() {
    		book.pages = to_number(this.value);
    		$$invalidate(0, book);
    	}

    	function input3_change_handler() {
    		book.genres = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(0, book);
    	}

    	function input4_change_handler() {
    		book.genres = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(0, book);
    	}

    	function input5_change_handler() {
    		book.genres = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(0, book);
    	}

    	function input6_change_handler() {
    		book.genres = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(0, book);
    	}

    	function input7_change_handler() {
    		book.genres = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(0, book);
    	}

    	function input8_input_handler() {
    		book.rating = to_number(this.value);
    		$$invalidate(0, book);
    	}

    	$$self.$capture_state = () => ({ book, result, doPost });

    	$$self.$inject_state = $$props => {
    		if ('book' in $$props) $$invalidate(0, book = $$props.book);
    		if ('result' in $$props) result = $$props.result;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		book,
    		doPost,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_change_handler,
    		$$binding_groups,
    		input4_change_handler,
    		input5_change_handler,
    		input6_change_handler,
    		input7_change_handler,
    		input8_input_handler
    	];
    }

    class AddBook extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "AddBook",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src\components\BookList.svelte generated by Svelte v3.50.1 */

    const { console: console_1 } = globals;
    const file$5 = "src\\components\\BookList.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	return child_ctx;
    }

    // (65:6) {#if editForm}
    function create_if_block(ctx) {
    	let form;
    	let input0;
    	let t0;
    	let input1;
    	let t1;
    	let input2;
    	let t2;
    	let label;
    	let t3;
    	let br0;
    	let t4;
    	let input3;
    	let t5;
    	let br1;
    	let t6;
    	let input4;
    	let t7;
    	let br2;
    	let t8;
    	let input5;
    	let t9;
    	let br3;
    	let t10;
    	let input6;
    	let t11;
    	let br4;
    	let t12;
    	let input7;
    	let t13;
    	let br5;
    	let t14;
    	let input8;
    	let t15;
    	let button0;
    	let t17;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			form = element("form");
    			input0 = element("input");
    			t0 = space();
    			input1 = element("input");
    			t1 = space();
    			input2 = element("input");
    			t2 = space();
    			label = element("label");
    			t3 = text("Genres: ");
    			br0 = element("br");
    			t4 = space();
    			input3 = element("input");
    			t5 = text("Action");
    			br1 = element("br");
    			t6 = space();
    			input4 = element("input");
    			t7 = text("Crime");
    			br2 = element("br");
    			t8 = space();
    			input5 = element("input");
    			t9 = text("Drama");
    			br3 = element("br");
    			t10 = space();
    			input6 = element("input");
    			t11 = text("Horror");
    			br4 = element("br");
    			t12 = space();
    			input7 = element("input");
    			t13 = text("Thriller");
    			br5 = element("br");
    			t14 = space();
    			input8 = element("input");
    			t15 = space();
    			button0 = element("button");
    			button0.textContent = "Submit";
    			t17 = space();
    			button1 = element("button");
    			button1.textContent = "Close";
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "Title");
    			add_location(input0, file$5, 66, 12, 1528);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "placeholder", "Author");
    			add_location(input1, file$5, 67, 12, 1605);
    			attr_dev(input2, "type", "number");
    			attr_dev(input2, "placeholder", "Number of pages");
    			add_location(input2, file$5, 68, 12, 1684);
    			add_location(br0, file$5, 70, 23, 1805);
    			attr_dev(input3, "type", "checkbox");
    			input3.__value = "Action";
    			input3.value = input3.__value;
    			/*$$binding_groups*/ ctx[9][0].push(input3);
    			add_location(input3, file$5, 71, 15, 1826);
    			add_location(br1, file$5, 71, 84, 1895);
    			attr_dev(input4, "type", "checkbox");
    			input4.__value = "Crime";
    			input4.value = input4.__value;
    			/*$$binding_groups*/ ctx[9][0].push(input4);
    			add_location(input4, file$5, 72, 15, 1916);
    			add_location(br2, file$5, 72, 82, 1983);
    			attr_dev(input5, "type", "checkbox");
    			input5.__value = "Drama";
    			input5.value = input5.__value;
    			/*$$binding_groups*/ ctx[9][0].push(input5);
    			add_location(input5, file$5, 73, 15, 2004);
    			add_location(br3, file$5, 73, 82, 2071);
    			attr_dev(input6, "type", "checkbox");
    			input6.__value = "Horror";
    			input6.value = input6.__value;
    			/*$$binding_groups*/ ctx[9][0].push(input6);
    			add_location(input6, file$5, 74, 15, 2092);
    			add_location(br4, file$5, 74, 84, 2161);
    			attr_dev(input7, "type", "checkbox");
    			input7.__value = "Thriller";
    			input7.value = input7.__value;
    			/*$$binding_groups*/ ctx[9][0].push(input7);
    			add_location(input7, file$5, 75, 15, 2182);
    			add_location(br5, file$5, 75, 88, 2255);
    			add_location(label, file$5, 69, 12, 1773);
    			attr_dev(input8, "type", "number");
    			attr_dev(input8, "placeholder", "Rating");
    			add_location(input8, file$5, 77, 12, 2295);
    			add_location(button0, file$5, 78, 12, 2376);
    			add_location(button1, file$5, 79, 12, 2435);
    			add_location(form, file$5, 65, 9, 1508);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, input0);
    			set_input_value(input0, /*book*/ ctx[2].title);
    			append_dev(form, t0);
    			append_dev(form, input1);
    			set_input_value(input1, /*book*/ ctx[2].author);
    			append_dev(form, t1);
    			append_dev(form, input2);
    			set_input_value(input2, /*book*/ ctx[2].pages);
    			append_dev(form, t2);
    			append_dev(form, label);
    			append_dev(label, t3);
    			append_dev(label, br0);
    			append_dev(label, t4);
    			append_dev(label, input3);
    			input3.checked = ~/*book*/ ctx[2].genres.indexOf(input3.__value);
    			append_dev(label, t5);
    			append_dev(label, br1);
    			append_dev(label, t6);
    			append_dev(label, input4);
    			input4.checked = ~/*book*/ ctx[2].genres.indexOf(input4.__value);
    			append_dev(label, t7);
    			append_dev(label, br2);
    			append_dev(label, t8);
    			append_dev(label, input5);
    			input5.checked = ~/*book*/ ctx[2].genres.indexOf(input5.__value);
    			append_dev(label, t9);
    			append_dev(label, br3);
    			append_dev(label, t10);
    			append_dev(label, input6);
    			input6.checked = ~/*book*/ ctx[2].genres.indexOf(input6.__value);
    			append_dev(label, t11);
    			append_dev(label, br4);
    			append_dev(label, t12);
    			append_dev(label, input7);
    			input7.checked = ~/*book*/ ctx[2].genres.indexOf(input7.__value);
    			append_dev(label, t13);
    			append_dev(label, br5);
    			append_dev(form, t14);
    			append_dev(form, input8);
    			set_input_value(input8, /*book*/ ctx[2].rating);
    			append_dev(form, t15);
    			append_dev(form, button0);
    			append_dev(form, t17);
    			append_dev(form, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[5]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[6]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[7]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[8]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[10]),
    					listen_dev(input5, "change", /*input5_change_handler*/ ctx[11]),
    					listen_dev(input6, "change", /*input6_change_handler*/ ctx[12]),
    					listen_dev(input7, "change", /*input7_change_handler*/ ctx[13]),
    					listen_dev(input8, "input", /*input8_input_handler*/ ctx[14]),
    					listen_dev(button0, "click", /*updateBook*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*editBook*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*book*/ 4 && input0.value !== /*book*/ ctx[2].title) {
    				set_input_value(input0, /*book*/ ctx[2].title);
    			}

    			if (dirty & /*book*/ 4 && input1.value !== /*book*/ ctx[2].author) {
    				set_input_value(input1, /*book*/ ctx[2].author);
    			}

    			if (dirty & /*book*/ 4 && to_number(input2.value) !== /*book*/ ctx[2].pages) {
    				set_input_value(input2, /*book*/ ctx[2].pages);
    			}

    			if (dirty & /*book*/ 4) {
    				input3.checked = ~/*book*/ ctx[2].genres.indexOf(input3.__value);
    			}

    			if (dirty & /*book*/ 4) {
    				input4.checked = ~/*book*/ ctx[2].genres.indexOf(input4.__value);
    			}

    			if (dirty & /*book*/ 4) {
    				input5.checked = ~/*book*/ ctx[2].genres.indexOf(input5.__value);
    			}

    			if (dirty & /*book*/ 4) {
    				input6.checked = ~/*book*/ ctx[2].genres.indexOf(input6.__value);
    			}

    			if (dirty & /*book*/ 4) {
    				input7.checked = ~/*book*/ ctx[2].genres.indexOf(input7.__value);
    			}

    			if (dirty & /*book*/ 4 && to_number(input8.value) !== /*book*/ ctx[2].rating) {
    				set_input_value(input8, /*book*/ ctx[2].rating);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			/*$$binding_groups*/ ctx[9][0].splice(/*$$binding_groups*/ ctx[9][0].indexOf(input3), 1);
    			/*$$binding_groups*/ ctx[9][0].splice(/*$$binding_groups*/ ctx[9][0].indexOf(input4), 1);
    			/*$$binding_groups*/ ctx[9][0].splice(/*$$binding_groups*/ ctx[9][0].indexOf(input5), 1);
    			/*$$binding_groups*/ ctx[9][0].splice(/*$$binding_groups*/ ctx[9][0].indexOf(input6), 1);
    			/*$$binding_groups*/ ctx[9][0].splice(/*$$binding_groups*/ ctx[9][0].indexOf(input7), 1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(65:6) {#if editForm}",
    		ctx
    	});

    	return block;
    }

    // (85:6) {#each books as book }
    function create_each_block$1(ctx) {
    	let tr;
    	let td0;
    	let p0;
    	let t0_value = /*book*/ ctx[2]._id + "";
    	let t0;
    	let t1;
    	let td1;
    	let p1;
    	let t2_value = /*book*/ ctx[2].title + "";
    	let t2;
    	let t3;
    	let td2;
    	let button0;
    	let t5;
    	let td3;
    	let form;
    	let button1;
    	let t7;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			td0 = element("td");
    			p0 = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			p1 = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			td2 = element("td");
    			button0 = element("button");
    			button0.textContent = "Edit";
    			t5 = space();
    			td3 = element("td");
    			form = element("form");
    			button1 = element("button");
    			button1.textContent = "Delete";
    			t7 = space();
    			add_location(p0, file$5, 86, 16, 2596);
    			attr_dev(td0, "class", "svelte-1r4oile");
    			add_location(td0, file$5, 86, 12, 2592);
    			add_location(p1, file$5, 87, 16, 2636);
    			attr_dev(td1, "class", "svelte-1r4oile");
    			add_location(td1, file$5, 87, 12, 2632);
    			add_location(button0, file$5, 88, 16, 2678);
    			attr_dev(td2, "class", "svelte-1r4oile");
    			add_location(td2, file$5, 88, 12, 2674);
    			add_location(button1, file$5, 90, 21, 2771);
    			add_location(form, file$5, 90, 15, 2765);
    			attr_dev(td3, "class", "svelte-1r4oile");
    			add_location(td3, file$5, 89, 12, 2744);
    			add_location(tr, file$5, 85, 9, 2574);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			append_dev(tr, td0);
    			append_dev(td0, p0);
    			append_dev(p0, t0);
    			append_dev(tr, t1);
    			append_dev(tr, td1);
    			append_dev(td1, p1);
    			append_dev(p1, t2);
    			append_dev(tr, t3);
    			append_dev(tr, td2);
    			append_dev(td2, button0);
    			append_dev(tr, t5);
    			append_dev(tr, td3);
    			append_dev(td3, form);
    			append_dev(form, button1);
    			append_dev(tr, t7);

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						button0,
    						"click",
    						function () {
    							if (is_function(/*editBook*/ ctx[3](/*book*/ ctx[2]))) /*editBook*/ ctx[3](/*book*/ ctx[2]).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						button1,
    						"click",
    						function () {
    							if (is_function(deleteBook(/*book*/ ctx[2]._id))) deleteBook(/*book*/ ctx[2]._id).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*books*/ 1 && t0_value !== (t0_value = /*book*/ ctx[2]._id + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*books*/ 1 && t2_value !== (t2_value = /*book*/ ctx[2].title + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(85:6) {#each books as book }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let div1;
    	let div0;
    	let t;
    	let table;
    	let if_block = /*editForm*/ ctx[1] && create_if_block(ctx);
    	let each_value = /*books*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			if (if_block) if_block.c();
    			t = space();
    			table = element("table");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div0, "class", "edit-form svelte-1r4oile");
    			add_location(div0, file$5, 63, 3, 1452);
    			attr_dev(table, "class", "svelte-1r4oile");
    			add_location(table, file$5, 83, 3, 2526);
    			add_location(div1, file$5, 62, 0, 1442);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			if (if_block) if_block.m(div0, null);
    			append_dev(div1, t);
    			append_dev(div1, table);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*editForm*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*deleteBook, books, editBook*/ 9) {
    				each_value = /*books*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(table, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    async function deleteBook(id) {
    	const res = await fetch('http://localhost:3000/books/' + id, { method: 'DELETE' });
    	await res.json();
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('BookList', slots, []);
    	let books = [];

    	onMount(async () => {
    		fetch("http://localhost:3000/books").then(response => response.json()).then(data => {
    			$$invalidate(0, books = data);
    		}).catch(error => {
    			console.log(error);
    			return [];
    		});
    	});

    	let book = {
    		title: '',
    		author: '',
    		pages: '',
    		genres: [],
    		rating: ''
    	};

    	let updateID = '';
    	let editForm = false;

    	function editBook(e) {
    		$$invalidate(2, book = {
    			title: e.title,
    			author: e.author,
    			pages: e.pages,
    			genres: e.genres,
    			rating: e.rating
    		});

    		updateID = e._id;
    		console.log(updateID, 'test updateID');
    		$$invalidate(1, editForm = !editForm);
    	}

    	function updateBook() {
    		// console.log(book, 'test update')
    		// console.log(updateID, 'test id')
    		fetch('http://localhost:3000/books/' + updateID, {
    			method: 'PATCH',
    			headers: { 'Content-Type': 'application/json' },
    			body: JSON.stringify(book)
    		}).then(response => response.json()).then(result => console.log(result));
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<BookList> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function input0_input_handler() {
    		book.title = this.value;
    		$$invalidate(2, book);
    	}

    	function input1_input_handler() {
    		book.author = this.value;
    		$$invalidate(2, book);
    	}

    	function input2_input_handler() {
    		book.pages = to_number(this.value);
    		$$invalidate(2, book);
    	}

    	function input3_change_handler() {
    		book.genres = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(2, book);
    	}

    	function input4_change_handler() {
    		book.genres = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(2, book);
    	}

    	function input5_change_handler() {
    		book.genres = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(2, book);
    	}

    	function input6_change_handler() {
    		book.genres = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(2, book);
    	}

    	function input7_change_handler() {
    		book.genres = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(2, book);
    	}

    	function input8_input_handler() {
    		book.rating = to_number(this.value);
    		$$invalidate(2, book);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		books,
    		deleteBook,
    		book,
    		updateID,
    		editForm,
    		editBook,
    		updateBook
    	});

    	$$self.$inject_state = $$props => {
    		if ('books' in $$props) $$invalidate(0, books = $$props.books);
    		if ('book' in $$props) $$invalidate(2, book = $$props.book);
    		if ('updateID' in $$props) updateID = $$props.updateID;
    		if ('editForm' in $$props) $$invalidate(1, editForm = $$props.editForm);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		books,
    		editForm,
    		book,
    		editBook,
    		updateBook,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_change_handler,
    		$$binding_groups,
    		input4_change_handler,
    		input5_change_handler,
    		input6_change_handler,
    		input7_change_handler,
    		input8_input_handler
    	];
    }

    class BookList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "BookList",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\components\Footer.svelte generated by Svelte v3.50.1 */

    const file$4 = "src\\components\\Footer.svelte";

    function create_fragment$4(ctx) {
    	let footer;
    	let div;

    	const block = {
    		c: function create() {
    			footer = element("footer");
    			div = element("div");
    			div.textContent = ".....";
    			attr_dev(div, "class", "copyright svelte-10p7f19");
    			add_location(div, file$4, 1, 3, 13);
    			attr_dev(footer, "class", "svelte-10p7f19");
    			add_location(footer, file$4, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, footer, anchor);
    			append_dev(footer, div);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\components\Header.svelte generated by Svelte v3.50.1 */

    const file$3 = "src\\components\\Header.svelte";

    function create_fragment$3(ctx) {
    	let header;
    	let p;

    	const block = {
    		c: function create() {
    			header = element("header");
    			p = element("p");
    			p.textContent = "HELLO WORLD!";
    			attr_dev(p, "class", "svelte-1y2t63w");
    			add_location(p, file$3, 1, 3, 13);
    			attr_dev(header, "class", "svelte-1y2t63w");
    			add_location(header, file$3, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, p);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\components\Jsonplaceholder.svelte generated by Svelte v3.50.1 */
    const file$2 = "src\\components\\Jsonplaceholder.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (13:3) {#each jsonplaceholder as json (json.id) }
    function create_each_block(key_1, ctx) {
    	let p;
    	let t_value = /*json*/ ctx[1].name + "";
    	let t;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			p = element("p");
    			t = text(t_value);
    			add_location(p, file$2, 13, 6, 319);
    			this.first = p;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*jsonplaceholder*/ 1 && t_value !== (t_value = /*json*/ ctx[1].name + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(13:3) {#each jsonplaceholder as json (json.id) }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_value = /*jsonplaceholder*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*json*/ ctx[1].id;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(div, file$2, 11, 0, 259);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*jsonplaceholder*/ 1) {
    				each_value = /*jsonplaceholder*/ ctx[0];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div, destroy_block, create_each_block, null, get_each_context);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Jsonplaceholder', slots, []);
    	let jsonplaceholder = [];

    	onMount(async () => {
    		const response = await fetch('https://jsonplaceholder.typicode.com/users');
    		$$invalidate(0, jsonplaceholder = await response.json());
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Jsonplaceholder> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ onMount, jsonplaceholder });

    	$$self.$inject_state = $$props => {
    		if ('jsonplaceholder' in $$props) $$invalidate(0, jsonplaceholder = $$props.jsonplaceholder);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [jsonplaceholder];
    }

    class Jsonplaceholder extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Jsonplaceholder",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\shared\Card.svelte generated by Svelte v3.50.1 */

    const file$1 = "src\\shared\\Card.svelte";

    function create_fragment$1(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "class", "card svelte-1k8ymt0");
    			add_location(div, file$1, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[0],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Card', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Card> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots];
    }

    class Card extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Card",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.50.1 */
    const file = "src\\App.svelte";

    // (15:6) <Card>
    function create_default_slot_2(ctx) {
    	let addbook;
    	let current;
    	addbook = new AddBook({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(addbook.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(addbook, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(addbook.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(addbook.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(addbook, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(15:6) <Card>",
    		ctx
    	});

    	return block;
    }

    // (25:9) {#key count }
    function create_key_block(ctx) {
    	let booklist;
    	let current;
    	booklist = new BookList({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(booklist.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(booklist, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(booklist.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(booklist.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(booklist, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block.name,
    		type: "key",
    		source: "(25:9) {#key count }",
    		ctx
    	});

    	return block;
    }

    // (21:5) <Card>
    function create_default_slot_1(ctx) {
    	let button;
    	let t1;
    	let h3;
    	let t3;
    	let p;
    	let t5;
    	let previous_key = /*count*/ ctx[0];
    	let key_block_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let key_block = create_key_block(ctx);

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Refresh";
    			t1 = space();
    			h3 = element("h3");
    			h3.textContent = "From mongoDB";
    			t3 = space();
    			p = element("p");
    			p.textContent = "Books:";
    			t5 = space();
    			key_block.c();
    			key_block_anchor = empty();
    			add_location(button, file, 21, 9, 519);
    			add_location(h3, file, 22, 9, 578);
    			add_location(p, file, 23, 9, 609);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, h3, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, p, anchor);
    			insert_dev(target, t5, anchor);
    			key_block.m(target, anchor);
    			insert_dev(target, key_block_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[1], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*count*/ 1 && safe_not_equal(previous_key, previous_key = /*count*/ ctx[0])) {
    				group_outros();
    				transition_out(key_block, 1, 1, noop);
    				check_outros();
    				key_block = create_key_block(ctx);
    				key_block.c();
    				transition_in(key_block, 1);
    				key_block.m(key_block_anchor.parentNode, key_block_anchor);
    			} else {
    				key_block.p(ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(key_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(key_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(h3);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(key_block_anchor);
    			key_block.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(21:5) <Card>",
    		ctx
    	});

    	return block;
    }

    // (32:6) <Card>
    function create_default_slot(ctx) {
    	let h3;
    	let t1;
    	let jsonplaceholder;
    	let current;
    	jsonplaceholder = new Jsonplaceholder({ $$inline: true });

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "From jsonplaceholder";
    			t1 = space();
    			create_component(jsonplaceholder.$$.fragment);
    			add_location(h3, file, 32, 9, 775);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(jsonplaceholder, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(jsonplaceholder.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(jsonplaceholder.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    			if (detaching) detach_dev(t1);
    			destroy_component(jsonplaceholder, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(32:6) <Card>",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let header;
    	let t0;
    	let main;
    	let div0;
    	let card0;
    	let t1;
    	let div1;
    	let card1;
    	let t2;
    	let div2;
    	let card2;
    	let t3;
    	let footer;
    	let current;
    	header = new Header({ $$inline: true });

    	card0 = new Card({
    			props: {
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	card1 = new Card({
    			props: {
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	card2 = new Card({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(header.$$.fragment);
    			t0 = space();
    			main = element("main");
    			div0 = element("div");
    			create_component(card0.$$.fragment);
    			t1 = space();
    			div1 = element("div");
    			create_component(card1.$$.fragment);
    			t2 = space();
    			div2 = element("div");
    			create_component(card2.$$.fragment);
    			t3 = space();
    			create_component(footer.$$.fragment);
    			attr_dev(div0, "class", "add-book svelte-xcfhtw");
    			add_location(div0, file, 13, 3, 387);
    			attr_dev(div1, "class", "bookstore svelte-xcfhtw");
    			add_location(div1, file, 19, 3, 474);
    			attr_dev(div2, "class", "jsonplaceholder");
    			add_location(div2, file, 30, 3, 723);
    			attr_dev(main, "class", "svelte-xcfhtw");
    			add_location(main, file, 12, 0, 377);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(header, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, div0);
    			mount_component(card0, div0, null);
    			append_dev(main, t1);
    			append_dev(main, div1);
    			mount_component(card1, div1, null);
    			append_dev(main, t2);
    			append_dev(main, div2);
    			mount_component(card2, div2, null);
    			insert_dev(target, t3, anchor);
    			mount_component(footer, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const card0_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				card0_changes.$$scope = { dirty, ctx };
    			}

    			card0.$set(card0_changes);
    			const card1_changes = {};

    			if (dirty & /*$$scope, count*/ 5) {
    				card1_changes.$$scope = { dirty, ctx };
    			}

    			card1.$set(card1_changes);
    			const card2_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				card2_changes.$$scope = { dirty, ctx };
    			}

    			card2.$set(card2_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(card0.$$.fragment, local);
    			transition_in(card1.$$.fragment, local);
    			transition_in(card2.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(card0.$$.fragment, local);
    			transition_out(card1.$$.fragment, local);
    			transition_out(card2.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(header, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(main);
    			destroy_component(card0);
    			destroy_component(card1);
    			destroy_component(card2);
    			if (detaching) detach_dev(t3);
    			destroy_component(footer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let count = 0;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(0, count++, count);

    	$$self.$capture_state = () => ({
    		AddBook,
    		BookList,
    		Footer,
    		Header,
    		Jsonplaceholder,
    		Card,
    		count
    	});

    	$$self.$inject_state = $$props => {
    		if ('count' in $$props) $$invalidate(0, count = $$props.count);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [count, click_handler];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
