!macro customInstall
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mp4\shell\VideoToolkitCompress" "MUIVerb" "Comprimir con Video Toolkit"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mp4\shell\VideoToolkitCompress" "Icon" "$INSTDIR\Video Toolkit.exe"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mp4\shell\VideoToolkitCompress\command" "" '"$INSTDIR\Video Toolkit.exe" --compress "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.mp4\shell\VideoToolkitCompress"
!macroend
