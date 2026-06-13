class ESP8266_joystickExtension {
    constructor(runtime) {
        this.runtime = runtime;
        
        // 存放 Web Serial 的連線物件
        this.port = null;
        this.reader = null;
        this.writer = null;

        // 紀錄 8 個按鈕的當前狀態 (0: 放開, 1: 按下)
        this.buttonStates = {
            'F': 0, 'B': 0, 'L': 0, 'R': 0,
            'U': 0, 'D': 0, 'O': 0, 'C': 0
        };
    }

    /**
     * 1. 定義積木與介面 (UI)
     */
    getInfo() {
        return {
            id: 'ESP8266_joystick', // ⚠️ 這是最關鍵的 ID，必須和資料夾名稱完全一致
            name: 'ESP8266 搖桿',
            color1: '#0FBD8C', // 積木主色
            color2: '#0DA57A', // 積木邊框色
            blocks: [
                {
                    // 命令積木：建立 USB 連線
                    opcode: 'connectUSB',
                    blockType: 'command', // 原始碼專用寫法
                    text: '🔌 連接 ESP8266 搖桿 (USB)'
                },
                {
                    // 布林積木：偵測按鈕是否被按下
                    opcode: 'isButtonPressed',
                    blockType: 'Boolean', // 原始碼專用寫法
                    text: '搖桿 [BUTTON] 鍵被按下？',
                    arguments: {
                        BUTTON: {
                            type: 'string',
                            menu: 'buttonMenu',
                            defaultValue: 'F'
                        }
                    }
                },
                {
                    // 命令積木：設定 WS2812 燈光顏色
                    opcode: 'setLEDColor',
                    blockType: 'command',
                    text: '設定 WS2812 顏色 R:[R] G:[G] B:[B]',
                    arguments: {
                        R: { type: 'number', defaultValue: 255 },
                        G: { type: 'number', defaultValue: 0 },
                        B: { type: 'number', defaultValue: 0 }
                    }
                }
            ],
            menus: {
                buttonMenu: {
                    acceptReporters: true,
                    items: ['F', 'B', 'L', 'R', 'U', 'D', 'O', 'C']
                }
            }
        };
    }

    /**
     * 2. Web Serial 連線與讀取邏輯
     */
    async connectUSB() {
        if (!('serial' in navigator)) {
            alert('您的瀏覽器不支援 Web Serial API，請使用最新版 Chrome 或 Edge。');
            return;
        }

        try {
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: 115200 });
            console.log("USB 連線成功！");
            this.startReading();
        } catch (error) {
            console.error('連線失敗:', error);
        }
    }

    async startReading() {
        // 使用瀏覽器內建的 TextDecoderStream
        const textDecoder = new window.TextDecoderStream();
        this.port.readable.pipeTo(textDecoder.writable);
        this.reader = textDecoder.readable.getReader();

        let buffer = "";

        try {
            while (true) {
                const { value, done } = await this.reader.read();
                if (done) break;
                
                buffer += value;
                let lines = buffer.split('\n');
                buffer = lines.pop(); 

                for (let line of lines) {
                    this.parseData(line.trim());
                }
            }
        } catch (error) {
            console.error('讀取資料錯誤:', error);
        } finally {
            this.reader.releaseLock();
        }
    }

    parseData(data) {
        if (data.startsWith("BTN:")) {
            let parts = data.split(":");
            if (parts.length === 3) {
                let btn = parts[1];
                let state = parseInt(parts[2]);
                if (this.buttonStates[btn] !== undefined) {
                    this.buttonStates[btn] = state;
                }
            }
        }
    }

    /**
     * 3. 積木對應的執行函式
     */
    isButtonPressed(args) {
        const btn = args.BUTTON;
        return this.buttonStates[btn] === 1;
    }

    async setLEDColor(args) {
        if (!this.port || !this.port.writable) return;

        const command = `LED:${args.R},${args.G},${args.B}\n`;
        const encoder = new window.TextEncoder();
        const writer = this.port.writable.getWriter();
        try {
            await writer.write(encoder.encode(command));
        } catch (error) {
            console.error("寫入錯誤:", error);
        } finally {
            writer.releaseLock();
        }
    }
}

// ⚠️ 匯出這個類別，讓 Scratch 系統可以載入它 (原始碼專用寫法)
module.exports = ESP8266_joystickExtension;
