!macro preInit
    ; 1. 获取当前用户选择路径的长度
    StrLen $2 $INSTDIR
    
    ; 2. 获取产品名称的长度
    StrLen $3 "${APP_FILENAME}"
    
    ; 3. 截取当前路径最后 $3 个字符
    StrCpy $4 $INSTDIR "" -$3
    
    ; 4. 判断最后几个字符是否已经是产品名称
    ${If} $4 != "${APP_FILENAME}"
        ; 5. 检查路径末尾是否有反斜杠
        StrCpy $5 $INSTDIR "" -1
        ${If} $5 == "\"
            StrCpy $INSTDIR "$INSTDIR${APP_FILENAME}"
        ${Else}
            StrCpy $INSTDIR "$INSTDIR\${APP_FILENAME}"
        ${EndIf}
    ${EndIf}
!macroend