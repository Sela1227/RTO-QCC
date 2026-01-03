"""PDF 生成服務"""
import os
from datetime import date
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import black, HexColor
from app.config.settings import AppSettings


class PDFService:
    """PDF 生成服務"""
    
    def __init__(self):
        self.exports_dir = AppSettings.EXPORT_DIR
        if not os.path.exists(self.exports_dir):
            os.makedirs(self.exports_dir)
        
        # 嘗試註冊中文字體
        self._register_fonts()
    
    def _register_fonts(self):
        """註冊中文字體"""
        font_paths = [
            # Windows
            ("C:/Windows/Fonts/msjh.ttc", 0),  # 微軟正黑體
            ("C:/Windows/Fonts/mingliu.ttc", 0),  # 細明體
            ("C:/Windows/Fonts/kaiu.ttf", None),  # 標楷體
            # macOS
            ("/System/Library/Fonts/PingFang.ttc", 0),
            ("/Library/Fonts/Arial Unicode.ttf", None),
            # Linux
            ("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", 0),
            ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 0),
        ]
        
        self.font_name = "Helvetica"  # 預設
        
        for path_info in font_paths:
            path = path_info[0]
            subfont = path_info[1]
            if os.path.exists(path):
                try:
                    if subfont is not None:
                        pdfmetrics.registerFont(TTFont('ChineseFont', path, subfontIndex=subfont))
                    else:
                        pdfmetrics.registerFont(TTFont('ChineseFont', path))
                    self.font_name = "ChineseFont"
                    break
                except:
                    continue
    
    def generate_nutrition_referral(self, patient, treatment, referrer: str = "", 
                                    phone: str = "", notes: str = "") -> str:
        """
        生成營養轉介單 PDF（癌症資源中心轉介單）
        
        Args:
            patient: 病人資料
            treatment: 療程資料  
            referrer: 轉介同仁
            phone: 連絡電話
            notes: 備註
        
        Returns:
            PDF 檔案路徑
        """
        today = date.today()
        filename = f"nutrition_referral_{patient.medical_id}_{today.strftime('%Y%m%d')}.pdf"
        filepath = os.path.join(self.exports_dir, filename)
        
        c = canvas.Canvas(filepath, pagesize=A4)
        width, height = A4
        
        # 粉紅色背景
        c.setFillColor(HexColor("#FFE4EC"))
        c.rect(0, 0, width, height, fill=True, stroke=False)
        c.setFillColor(black)
        
        # === 頁首 ===
        y_top = height - 20*mm
        
        # 左上標語
        c.setFont(self.font_name, 9)
        c.drawString(15*mm, y_top, "用心、創新、追根究底")
        
        # 右上醫院名稱
        c.setFont(self.font_name, 11)
        c.drawRightString(width - 15*mm, y_top, "秀傳醫療財團法人彰濱秀傳紀念醫院")
        c.setFont(self.font_name, 8)
        c.drawRightString(width - 15*mm, y_top - 5*mm, "Chang Bing Show Chwan Memorial Hospital")
        
        # === 表單標題 ===
        c.setFont(self.font_name, 16)
        c.drawCentredString(width/2, y_top - 20*mm, "癌症資源中心轉介單")
        
        # === 表格 ===
        margin_left = 15*mm
        margin_right = width - 15*mm
        table_width = margin_right - margin_left
        
        y = y_top - 35*mm
        row_h = 12*mm
        
        c.setStrokeColor(black)
        c.setLineWidth(0.5)
        
        # 第一行：日期 | 年月日 | 轉介同仁
        c.rect(margin_left, y - row_h, table_width, row_h)
        c.line(margin_left + 20*mm, y, margin_left + 20*mm, y - row_h)
        c.line(margin_left + 110*mm, y, margin_left + 110*mm, y - row_h)
        
        c.setFont(self.font_name, 11)
        c.drawCentredString(margin_left + 10*mm, y - 8*mm, "日期")
        c.drawCentredString(margin_left + 65*mm, y - 8*mm, 
                          f"{today.year}    年    {today.month}    月    {today.day}    日")
        c.drawString(margin_left + 115*mm, y - 8*mm, f"轉介同仁 {referrer}")
        
        # 第二行：姓名 | 病歷號 | 癌別
        y -= row_h
        c.rect(margin_left, y - row_h, table_width, row_h)
        c.line(margin_left + 60*mm, y, margin_left + 60*mm, y - row_h)
        c.line(margin_left + 120*mm, y, margin_left + 120*mm, y - row_h)
        
        c.drawString(margin_left + 5*mm, y - 8*mm, f"姓名  {patient.name}")
        age_str = f"（{patient.age}歲）" if patient.age else ""
        c.drawString(margin_left + 35*mm, y - 8*mm, age_str)
        c.drawString(margin_left + 65*mm, y - 8*mm, f"病歷號  {patient.medical_id_display}")
        c.drawString(margin_left + 125*mm, y - 8*mm, f"癌別  {treatment.cancer_type_label}")
        
        # 第三行：連絡電話
        y -= row_h
        c.rect(margin_left, y - row_h, table_width, row_h)
        c.drawString(margin_left + 5*mm, y - 8*mm, f"連絡電話  {phone}")
        
        # 第四行：轉介需求（多行）
        y -= row_h
        need_h = 45*mm
        c.rect(margin_left, y - need_h, table_width, need_h)
        c.line(margin_left + 20*mm, y, margin_left + 20*mm, y - need_h)
        
        c.drawCentredString(margin_left + 10*mm, y - 10*mm, "轉介")
        c.drawCentredString(margin_left + 10*mm, y - 18*mm, "需求")
        
        # 轉介需求選項
        opt_x = margin_left + 25*mm
        c.setFont(self.font_name, 10)
        
        c.drawString(opt_x, y - 8*mm, "□ 輔助諮詢（經濟、營養品、居家照顧、義乳胸衣）")
        c.drawString(opt_x, y - 18*mm, "☑ 營養諮詢   □ 傷口照護諮詢   □ 心理支持")
        c.drawString(opt_x, y - 28*mm, "□ 租借（假髮、輔具）  □ 頭巾/髮帽  □ 病友團體")
        c.drawString(opt_x, y - 38*mm, "□ 其他：")
        
        # 備註區
        y -= need_h
        note_h = 25*mm
        c.rect(margin_left, y - note_h, table_width, note_h)
        c.line(margin_left + 20*mm, y, margin_left + 20*mm, y - note_h)
        
        c.setFont(self.font_name, 11)
        c.drawCentredString(margin_left + 10*mm, y - 12*mm, "備註")
        
        # 填入體重資訊
        c.setFont(self.font_name, 10)
        weight_info = f"基準：{treatment.baseline_weight:.1f}kg"
        if treatment.current_weight:
            weight_info += f" → 目前：{treatment.current_weight:.1f}kg"
        if treatment.current_change_rate:
            weight_info += f"（{treatment.current_change_rate:+.1f}%）"
        c.drawString(margin_left + 25*mm, y - 8*mm, weight_info)
        
        if notes:
            c.drawString(margin_left + 25*mm, y - 18*mm, notes[:50])
        
        # 預約區
        y -= note_h
        c.rect(margin_left, y - row_h, table_width, row_h)
        c.line(margin_left + 20*mm, y, margin_left + 20*mm, y - row_h)
        
        c.setFont(self.font_name, 11)
        c.drawCentredString(margin_left + 10*mm, y - 8*mm, "預約")
        
        # === 頁尾 ===
        c.setFont(self.font_name, 9)
        c.drawString(margin_left, 15*mm, 
                    "彰濱秀傳紀念醫院癌症資源中心製  連絡電話：04-7813888 分機 70211")
        
        c.save()
        return filepath

