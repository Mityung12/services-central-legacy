/* -*- Mode: C++; tab-width: 3; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Mozilla browser.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications, Inc.
 * Portions created by the Initial Developer are Copyright (C) 1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Scott MacGregor <mscott@netscape.com>
 *   Christian Biesinger <cbiesinger@web.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#include "nsArrayEnumerator.h"
#include "nsCOMArray.h"
#include "nsILocalFile.h"
#include "nsIVariant.h"
#include "nsMIMEInfoWin.h"
#include "nsNetUtil.h"
#include <Windows.h>
#include <shellapi.h>

NS_IMPL_ISUPPORTS_INHERITED1(nsMIMEInfoWin, nsMIMEInfoBase, nsIPropertyBag)

nsMIMEInfoWin::~nsMIMEInfoWin()
{
}

nsresult
nsMIMEInfoWin::LaunchDefaultWithFile(nsIFile* aFile)
{
  // Launch the file, unless it is an executable.
  nsCOMPtr<nsILocalFile> local(do_QueryInterface(aFile));
  if (!local)
    return NS_ERROR_FAILURE;

  PRBool executable = PR_TRUE;
  local->IsExecutable(&executable);
  if (executable)
    return NS_ERROR_FAILURE;

  return local->Launch();
}

NS_IMETHODIMP
nsMIMEInfoWin::GetHasDefaultHandler(PRBool * _retval)
{
  // We have a default application if we have a description
  // We can ShellExecute anything; however, callers are probably interested if
  // there is really an application associated with this type of file
  *_retval = !mDefaultAppDescription.IsEmpty();
  return NS_OK;
}

NS_IMETHODIMP
nsMIMEInfoWin::GetEnumerator(nsISimpleEnumerator* *_retval)
{
  nsCOMArray<nsIVariant> properties;

  nsCOMPtr<nsIVariant> variant;
  GetProperty(NS_LITERAL_STRING("defaultApplicationIconURL"), getter_AddRefs(variant));
  if (variant)
    properties.AppendObject(variant);

  GetProperty(NS_LITERAL_STRING("customApplicationIconURL"), getter_AddRefs(variant));
  if (variant)
    properties.AppendObject(variant);

  return NS_NewArrayEnumerator(_retval, properties);
}

static nsresult GetIconURLVariant(nsIFile* aApplication, nsIVariant* *_retval)
{
  nsresult rv = CallCreateInstance("@mozilla.org/variant;1", _retval);
  if (NS_FAILED(rv))
    return rv;
  nsCAutoString fileURLSpec;
  NS_GetURLSpecFromFile(aApplication, fileURLSpec);
  nsCAutoString iconURLSpec; iconURLSpec.AssignLiteral("moz-icon://");
  iconURLSpec += fileURLSpec;
  nsCOMPtr<nsIWritableVariant> writable(do_QueryInterface(*_retval));
  writable->SetAsAUTF8String(iconURLSpec);
  return NS_OK;
}

NS_IMETHODIMP
nsMIMEInfoWin::GetProperty(const nsAString& aName, nsIVariant* *_retval)
{
  nsresult rv;
  if (mDefaultApplication && aName.EqualsLiteral(PROPERTY_DEFAULT_APP_ICON_URL)) {
    rv = GetIconURLVariant(mDefaultApplication, _retval);
    NS_ENSURE_SUCCESS(rv, rv);    
  } else if (mPreferredApplication && 
             aName.EqualsLiteral(PROPERTY_CUSTOM_APP_ICON_URL)) {
    nsCOMPtr<nsILocalHandlerApp> localHandler =
      do_QueryInterface(mPreferredApplication, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    
    nsCOMPtr<nsIFile> executable;
    rv = localHandler->GetExecutable(getter_AddRefs(executable));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = GetIconURLVariant(executable, _retval);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return NS_OK;
}

// this implementation was pretty much copied verbatime from 
// Tony Robinson's code in nsExternalProtocolWin.cpp
nsresult
nsMIMEInfoWin::LoadUriInternal(nsIURI * aURL)
{
  nsresult rv = NS_OK;

  // 1. Find the default app for this protocol
  // 2. Set up the command line
  // 3. Launch the app.

  // For now, we'll just cheat essentially, check for the command line
  // then just call ShellExecute()!

  if (aURL)
  {
    // extract the url spec from the url
    nsCAutoString urlSpec;
    aURL->GetAsciiSpec(urlSpec);

    // Some versions of windows (Win2k before SP3, Win XP before SP1)
    // crash in ShellExecute on long URLs (bug 161357).
    // IE 5 and 6 support URLS of 2083 chars in length, 2K is safe
    const PRUint32 maxSafeURL(2048);
    if (urlSpec.Length() > maxSafeURL)
      return NS_ERROR_FAILURE;

    LONG r = (LONG) ::ShellExecute(NULL, "open", urlSpec.get(), NULL, NULL, 
                                   SW_SHOWNORMAL);
    if (r < 32) 
      rv = NS_ERROR_FAILURE;
  }

  return rv;
}

