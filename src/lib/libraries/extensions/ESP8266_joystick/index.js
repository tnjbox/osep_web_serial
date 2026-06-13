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
     * 告訴 Scratch 這裡有哪些積木、選單、顏色和形狀
     */
    getInfo() {
        return {
            id: 'ESP8266_joystick',
            name: 'ESP8266 搖桿',
            color1: '#0FBD8C', // 積木主色
            color2: '#0DA57A', // 積木邊框色
            blocks: [
                {
                    // 命令積木：建立 USB 連線
                    opcode: 'connectUSB',
                    blockType: Scratch.BlockType.COMMAND,
                    text: '🔌 連接 ESP8266 搖桿 (USB)'
                },
                {
                    // 布林積木：偵測按鈕是否被按下
                    opcode: 'isButtonPressed',
                    blockType: Scratch.BlockType.BOOLEAN,
                    text: '搖桿 [BUTTON] 鍵被按下？',
                    arguments: {
                        BUTTON: {
                            type: Scratch.ArgumentType.STRING,
                            menu: 'buttonMenu',
                            defaultValue: 'F'
                        }
                    }
                },
                {
                    // 命令積木：設定 WS2812 燈光顏色
                    opcode: 'setLEDColor',
                    blockType: Scratch.BlockType.COMMAND,
                    text: '設定 WS2812 顏色 R:[R] G:[G] B:[B]',
                    arguments: {
                        R: { type: Scratch.ArgumentType.NUMBER, defaultValue: 255 },
                        G: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
                        B: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
                    }
                }
            ],
            menus: {
                // 定義下拉選單的選項
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
        // 檢查瀏覽器是否支援 Web Serial API
        if (!('serial' in navigator)) {
            alert('您的瀏覽器不支援 Web Serial API，請使用最新版 Chrome 或 Edge。');
            return;
        }

        try {
            // 彈出選擇 COM Port 視窗
            this.port = await navigator.serial.requestPort();
            // 開啟通訊埠，鮑率必須與 ESP8266 一致
            await this.port.open({ baudRate: 115200 });
            
            console.log("USB 連線成功！");

            // 啟動背景讀取迴圈
            this.startReading();
        } catch (error) {
            console.error('連線失敗:', error);
        }
    }

    async startReading() {
        // 使用 TextDecoderStream 將二進位資料轉為字串
        const textDecoder = new TextDecoderStream();
        this.port.readable.pipeTo(textDecoder.writable);
        this.reader = textDecoder.readable.getReader();

        let buffer = "";

        try {
            while (true) {
                const { value, done } = await this.reader.read();
                if (done) break;
                
                buffer += value;
                let lines = buffer.split('\n');
                
                // 保留最後一個不完整的片段
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

    // 解析 ESP8266 傳來的字串 (假設格式為 "BTN:F:1" 或 "BTN:F:0")
    parseData(data) {
        if (data.startsWith("BTN:")) {
            let parts = data.split(":");
            if (parts.length === 3) {
                let btn = parts[1]; // 例如 'F'
                let state = parseInt(parts[2]); // 1 或 0
                if (this.buttonStates[btn] !== undefined) {
                    this.buttonStates[btn] = state;
                }
            }
        }
    }

    /**
     * 3. 積木對應的執行函式
     */
    
    // 讀取按鈕狀態
    isButtonPressed(args) {
        const btn = args.BUTTON;
        return this.buttonStates[btn] === 1;
    }

    // 發送燈光控制指令給 ESP8266
    async setLEDColor(args) {
        if (!this.port || !this.port.writable) return;

        // 組合字串，例如 "LED:255,0,0\n"
        const command = `LED:${args.R},${args.G},${args.B}\n`;
        
        const encoder = new TextEncoder();
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

// 註冊擴充功能
Scratch.extensions.register(new OSEPJoystickExtension());
